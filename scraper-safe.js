const axios = require('axios');
const cheerio = require('cheerio');

// Logging helper with timestamps
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function log(...args) {
  console.log(`[${getTimestamp()}]`, ...args);
}

function logError(...args) {
  console.error(`[${getTimestamp()}]`, ...args);
}

// FilmTV.it configuration
const FILMTV_BASE_URL = 'https://www.filmtv.it';

// TMDB API configuration
let TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Rate limiting configuration
// Optimized for Railway: aggressive parallelism for fast catalog loading
const REQUEST_DELAY = 50; // delay between requests (ms) - reduced for speed
const MAX_CONCURRENT_REQUESTS = 20; // TMDB/http requests in parallel - increased significantly
const MAX_CONCURRENT_CATALOGS = 5; // catalogs processed simultaneously - increased
let activeRequests = 0;
let activeCatalogRequests = 0;
const requestQueue = [];
const catalogQueue = [];

// Function to set TMDB API key from user config
function setTMDBApiKey(apiKey) {
  TMDB_API_KEY = apiKey;
}

// In-memory cache only (NO file system writes)
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 2; // 2 hours (increased for better performance)

// Catalog cache (in-memory only)
const catalogCache = new Map();

// Response time tracking
const responseTimeStats = {
  catalog: [],
  meta: [],
  tmdb: []
};

// Track slow operations (> 5 seconds)
function trackResponseTime(type, duration, details = {}) {
  if (duration > 5000) {
    log(`⏱️ Slow ${type} operation: ${duration}ms`, details);
  }
  
  const stats = responseTimeStats[type] || [];
  stats.push({ duration, timestamp: Date.now(), ...details });
  
  // Keep only last 100 entries
  if (stats.length > 100) {
    stats.shift();
  }
  responseTimeStats[type] = stats;
}

// Get response time statistics
function getResponseTimeStats(type, minutes = 5) {
  const stats = responseTimeStats[type] || [];
  const cutoff = Date.now() - (minutes * 60 * 1000);
  const recent = stats.filter(s => s.timestamp > cutoff);
  
  if (recent.length === 0) return null;
  
  const durations = recent.map(s => s.duration);
  return {
    count: recent.length,
    avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    min: Math.min(...durations),
    max: Math.max(...durations),
    p95: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
  };
}

// In-flight promises to prevent duplicate concurrent requests
const inFlightPromises = new Map();

// Request tracking for monitoring (prevent bans)
const requestHistory = {
  http: [], // Array of timestamps for HTTP requests
  tmdb: [], // Array of timestamps for TMDB requests
  catalogs: [] // Array of timestamps for catalog processing
};

// Clean old entries (older than 1 hour)
function cleanRequestHistory() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  requestHistory.http = requestHistory.http.filter(ts => ts > oneHourAgo);
  requestHistory.tmdb = requestHistory.tmdb.filter(ts => ts > oneHourAgo);
  requestHistory.catalogs = requestHistory.catalogs.filter(ts => ts > oneHourAgo);
}

// Get request counts for last N minutes
function getRequestStats(minutes = 1) {
  cleanRequestHistory();
  const cutoff = Date.now() - (minutes * 60 * 1000);
  
  const httpCount = requestHistory.http.filter(ts => ts > cutoff).length;
  const tmdbCount = requestHistory.tmdb.filter(ts => ts > cutoff).length;
  const catalogCount = requestHistory.catalogs.filter(ts => ts > cutoff).length;
  
  return { httpCount, tmdbCount, catalogCount, minutes };
}

// Log usage stats periodically
let lastStatsLog = Date.now();
const STATS_LOG_INTERVAL = 5 * 60 * 1000; // Every 5 minutes

function logUsageStats() {
  const now = Date.now();
  if (now - lastStatsLog < STATS_LOG_INTERVAL) return;
  
  lastStatsLog = now;
  const stats1min = getRequestStats(1);
  const stats5min = getRequestStats(5);
  const stats60min = getRequestStats(60);
  
  log('📊 Usage Stats:');
  log(`  Last 1min: ${stats1min.httpCount} HTTP, ${stats1min.tmdbCount} TMDB, ${stats1min.catalogCount} catalogs`);
  log(`  Last 5min: ${stats5min.httpCount} HTTP, ${stats5min.tmdbCount} TMDB, ${stats5min.catalogCount} catalogs`);
  log(`  Last 60min: ${stats60min.httpCount} HTTP, ${stats60min.tmdbCount} TMDB, ${stats60min.catalogCount} catalogs`);
  
  // Warning if too many requests
  if (stats1min.tmdbCount > 100) {
    logError('⚠️ WARNING: High TMDB usage in last minute! Consider reducing rate limit.');
  }
  if (stats5min.tmdbCount > 300) {
    logError('⚠️ WARNING: High TMDB usage in last 5 minutes! Consider reducing rate limit.');
  }
}

// Rate limiting helper for HTTP requests
async function rateLimitedRequest(fn) {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        requestQueue.push(execute);
        return;
      }

      activeRequests++;
      try {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        const result = await fn();
        // Track request (check if it's TMDB by checking URL in fn result or context)
        requestHistory.http.push(Date.now());
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0) {
          const next = requestQueue.shift();
          next();
        }
      }
    };

    execute();
  });
}

// Rate limiting helper for catalog requests (prevents too many catalogs processing at once)
async function rateLimitedCatalogRequest(fn) {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      if (activeCatalogRequests >= MAX_CONCURRENT_CATALOGS) {
        catalogQueue.push(execute);
        return;
      }

      activeCatalogRequests++;
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeCatalogRequests--;
        if (catalogQueue.length > 0) {
          const next = catalogQueue.shift();
          next();
        }
      }
    };

    execute();
  });
}

// Fetch with proper headers and timeout
async function fetchWithCache(url) {
  const now = Date.now();
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url);
    if (now - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  return rateLimitedRequest(async () => {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 5000, // 5 second timeout (optimized for speed)
        maxRedirects: 5
      });

      cache.set(url, { data: response.data, timestamp: now });
      return response.data;
    } catch (error) {
      logError(`Error fetching ${url}:`, error.message);
      throw error;
    }
  });
}

// Fetch from TMDB with rate limiting
async function fetchFromTMDB(endpoint, params = {}) {
  const url = `${TMDB_BASE_URL}${endpoint}`;
  const cacheKey = `${url}?${JSON.stringify(params)}`;

  const now = Date.now();
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  return rateLimitedRequest(async () => {
    const tmdbStart = Date.now();
    try {
      // Track TMDB request
      requestHistory.tmdb.push(Date.now());
      logUsageStats(); // Log stats periodically
      
      const response = await axios.get(url, {
        params: {
          api_key: TMDB_API_KEY,
          language: 'it-IT',
          ...params
        },
        timeout: 5000, // 5 second timeout (optimized for speed)
        headers: {
          'Accept': 'application/json'
        }
      });

      const tmdbDuration = Date.now() - tmdbStart;
      trackResponseTime('tmdb', tmdbDuration, { endpoint });
      
      cache.set(cacheKey, { data: response.data, timestamp: now });
      return response.data;
    } catch (error) {
      const tmdbDuration = Date.now() - tmdbStart;
      trackResponseTime('tmdb', tmdbDuration, { endpoint, error: true });
      
      logError('TMDB API Error:', error.message);
      if (error.response) {
        logError('Status:', error.response.status);
        logError('Data:', error.response.data);
      }
      throw error;
    }
  });
}

function convertTMDBToStremio(tmdbMovie) {
  if (!tmdbMovie) return null;

  // TMDB uses numeric IDs, but we need IMDB IDs for Stremio
  const imdbId = tmdbMovie.imdb_id;
  if (!imdbId || !imdbId.startsWith('tt')) {
    // Reduced logging for performance - only log in debug mode if needed
    return null;
  }

  // Helper function to convert rating to stars
  function ratingToStars(rating) {
    const numStars = Math.round(rating / 2);
    return '⭐'.repeat(numStars);
  }

  // Build description with ratings
  let description = '';
  const ratings = [];
  if (tmdbMovie.filmtvRating) {
    ratings.push(`Voto medio: ${tmdbMovie.filmtvRating}/10`);
    const stars = ratingToStars(tmdbMovie.filmtvRating);
    ratings.push(`Voto critica: ${stars} (${tmdbMovie.filmtvRating})`);
    ratings.push(`Voto pubblico: ${stars} (${tmdbMovie.filmtvRating})`);
  }

  if (ratings.length > 0) {
    description = ratings.join('\n') + '\n\n';
  }

  description += tmdbMovie.overview || '';

  const stremioMovie = {
    id: imdbId,
    type: 'movie',
    name: tmdbMovie.title,
    poster: tmdbMovie.poster_path ? `${TMDB_IMAGE_BASE}${tmdbMovie.poster_path}` : null,
    posterShape: 'poster',
    background: tmdbMovie.backdrop_path ? `${TMDB_IMAGE_BASE}${tmdbMovie.backdrop_path}` : null,
    logo: `https://images.metahub.space/logo/medium/${imdbId}/img`,
    description: description,
    releaseInfo: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : null,
    imdbRating: tmdbMovie.vote_average ? tmdbMovie.vote_average.toFixed(1) : null,
    genres: tmdbMovie.genres ? tmdbMovie.genres.map(g => g.name) : [],
    runtime: tmdbMovie.runtime ? `${tmdbMovie.runtime} min` : null,
    country: tmdbMovie.production_countries && tmdbMovie.production_countries.length > 0
      ? tmdbMovie.production_countries[0].iso_3166_1
      : null
  };

  if (tmdbMovie.filmtvRating) {
    stremioMovie.filmtvRating = tmdbMovie.filmtvRating;
  }

  return stremioMovie;
}

async function getMovieWithIMDB(tmdbId) {
  try {
    const movieDetails = await fetchFromTMDB(`/movie/${tmdbId}`, {
      append_to_response: 'external_ids'
    });

    return {
      ...movieDetails,
      imdb_id: movieDetails.external_ids?.imdb_id || null
    };
  } catch (error) {
    logError(`Error fetching movie ${tmdbId}:`, error.message);
    return null;
  }
}

// Helper function to find best match from TMDB results
function findBestMatch(searchResults, searchTitle, searchYear, originalTitle = null, searchDecadeStart = null) {
  if (!searchResults.results || searchResults.results.length === 0) {
    return null;
  }

  const searchYearNum = searchYear ? parseInt(searchYear) : null;
  const decadeStartNum = searchDecadeStart ? parseInt(searchDecadeStart) : null;
  const decadeEndNum = decadeStartNum !== null ? decadeStartNum + 9 : null;
  const decadeMid = decadeStartNum !== null ? decadeStartNum + 5 : null;
  const searchLower = searchTitle.toLowerCase();
  const originalSearchLower = originalTitle ? originalTitle.toLowerCase() : null;
  
  // First pass: look for exact matches (highest priority)
  for (const result of searchResults.results) {
    const resultTitle = result.title || '';
    const resultOriginalTitle = result.original_title || '';
    const resultYear = result.release_date ? parseInt(result.release_date.substring(0, 4)) : null;
    const titleLower = resultTitle.toLowerCase();
    const originalLower = resultOriginalTitle.toLowerCase();

    // Skip documentaries, making-of, trailers, etc.
    if (titleLower.includes('making of') || 
        titleLower.includes('behind the scenes') ||
        titleLower.includes('documentary') ||
        titleLower.includes('trailer') ||
        titleLower.includes('the making of')) {
      continue;
    }

    // Exact title match with year match = perfect match
    if (originalTitle && (titleLower === originalSearchLower || originalLower === originalSearchLower)) {
      if (searchYearNum && resultYear === searchYearNum) {
        return result; // Perfect match, return immediately
      }
      // If decade is known, accept only if within decade
      if (!searchYearNum && decadeStartNum !== null && resultYear && resultYear >= decadeStartNum && resultYear <= decadeEndNum) {
        return result; // Exact title match within decade
      }
      // Only accept if year is very close (within 1 year)
      if (searchYearNum && resultYear && Math.abs(resultYear - searchYearNum) <= 1) {
        return result; // Exact title match, year very close
      }
      // If no year info at all and no decade, accept (rare)
      if (!searchYearNum && decadeStartNum === null && (!resultYear || Number.isNaN(resultYear))) {
        return result;
      }
    }
    
    // Exact match with search title
    if (titleLower === searchLower || originalLower === searchLower) {
      if (searchYearNum && resultYear === searchYearNum) {
        return result; // Perfect match
      }
      // If decade is known, accept only if within decade
      if (!searchYearNum && decadeStartNum !== null && resultYear && resultYear >= decadeStartNum && resultYear <= decadeEndNum) {
        return result; // Exact title match within decade
      }
      // Only accept if year is very close (within 1 year)
      if (searchYearNum && resultYear && Math.abs(resultYear - searchYearNum) <= 1) {
        return result; // Exact title match, year very close
      }
      // If no year info at all and no decade, accept (rare)
      if (!searchYearNum && decadeStartNum === null && (!resultYear || Number.isNaN(resultYear))) {
        return result;
      }
    }
  }

  // Second pass: if no exact match, use scoring system (but be more strict)
  let bestMatch = null;
  let bestScore = -1;

  for (const result of searchResults.results) {
    let score = 0;
    const resultTitle = result.title || '';
    const resultOriginalTitle = result.original_title || '';
    const resultYear = result.release_date ? parseInt(result.release_date.substring(0, 4)) : null;
    const titleLower = resultTitle.toLowerCase();
    const originalLower = resultOriginalTitle.toLowerCase();

    // Skip documentaries, making-of, trailers, etc.
    if (titleLower.includes('making of') || 
        titleLower.includes('behind the scenes') ||
        titleLower.includes('documentary') ||
        titleLower.includes('trailer') ||
        titleLower.includes('the making of')) {
      continue;
    }

    // Exact title match gets highest score
    if (originalTitle && (titleLower === originalSearchLower || originalLower === originalSearchLower)) {
      score += 200;
    } else if (titleLower === searchLower || originalLower === searchLower) {
      score += 100;
    } else {
      // Partial match - but only if year matches (to avoid wrong matches)
      if (titleLower.includes(searchLower) || searchLower.includes(titleLower) || originalLower.includes(searchLower) || searchLower.includes(originalLower)) {
        if (searchYearNum && resultYear && Math.abs(resultYear - searchYearNum) <= 2) {
          score += 30; // Partial match with year close
        } else if (!searchYearNum && decadeStartNum !== null && resultYear && resultYear >= decadeStartNum && resultYear <= decadeEndNum) {
          score += 20; // Partial match within decade
        } else {
          continue; // Skip partial matches without year/decade alignment
        }
      }
    }

    // Year match adds significant score
    if (searchYearNum && resultYear === searchYearNum) {
      score += 30;
    } else if (searchYearNum && resultYear && Math.abs(resultYear - searchYearNum) <= 1) {
      score += 10;
    } else if (!searchYearNum && decadeStartNum !== null && resultYear && resultYear >= decadeStartNum && resultYear <= decadeEndNum) {
      // Prefer movies inside the decade if year is not exact
      score += 15;
      // Small bonus for being near the middle of the decade
      if (decadeMid !== null && resultYear) {
        const dist = Math.abs(resultYear - decadeMid);
        score += Math.max(0, 5 - dist); // closer to mid gets up to +5
      }
    }

    // Prefer results with higher popularity if scores are similar
    score += Math.min(result.popularity || 0, 5);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  // Only return if we have a good match (score > 50)
  // Otherwise return null to try other search strategies
  return bestMatch && bestScore > 50 ? bestMatch : null;
}

async function searchMovieOnTMDB(title, year, filmtvRating = null, originalTitle = null, decadeStart = null) {
  try {
    // Optimized: Try both titles in parallel if we have original title
    const searchPromises = [];
    
    // Always search with Italian title first
    searchPromises.push(
      fetchFromTMDB('/search/movie', {
        query: title,
        year: year,
        include_adult: false
      }).then(results => ({ results, searchTitle: title, isOriginal: false }))
    );
    
    // If we have original title and it's different, search in parallel
    if (originalTitle && originalTitle !== title) {
      searchPromises.push(
        fetchFromTMDB('/search/movie', {
          query: originalTitle,
          year: year,
          include_adult: false
        }).then(results => ({ results, searchTitle: originalTitle, isOriginal: true }))
      );
    }
    
    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    
    let bestMatch = null;
    let bestScore = -1;
    
    // Evaluate all results together
    for (const { results, searchTitle, isOriginal } of searchResults) {
      if (results.results && results.results.length > 0) {
        const match = findBestMatch(results, searchTitle, year, isOriginal ? originalTitle : null, decadeStart);
        if (match) {
          // Score the match quality
          const matchYear = match.release_date ? parseInt(match.release_date.substring(0, 4)) : null;
          let score = 0;
          
          // Exact title match
          const matchTitle = (match.title || '').toLowerCase();
          const matchOriginal = (match.original_title || '').toLowerCase();
          const searchLower = searchTitle.toLowerCase();
          
          if (matchTitle === searchLower || matchOriginal === searchLower) {
            score += 100;
          }
          
          // Year match
          if (year && matchYear === parseInt(year)) {
            score += 50;
          } else if (year && matchYear && Math.abs(matchYear - parseInt(year)) <= 1) {
            score += 20;
          } else if (decadeStart && matchYear && matchYear >= decadeStart && matchYear <= decadeStart + 9) {
            score += 15;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = match;
          }
        }
      }
    }
    
    // Only retry without year if we have a very good reason (exact title match but year off)
    if (!bestMatch && originalTitle && originalTitle !== title) {
      // Only retry if we got close matches but year was off
      const hasCloseMatch = searchResults.some(({ results }) => 
        results.results && results.results.some(r => {
          const rTitle = (r.title || '').toLowerCase();
          const rOriginal = (r.original_title || '').toLowerCase();
          const origLower = originalTitle.toLowerCase();
          return rTitle === origLower || rOriginal === origLower;
        })
      );
      
      if (hasCloseMatch) {
        log(`🔄 Retrying search with original title (no year): ${originalTitle} (was: ${title})`);
        const searchResultsNoYear = await fetchFromTMDB('/search/movie', {
          query: originalTitle,
          include_adult: false
        });
        
        if (searchResultsNoYear.results && searchResultsNoYear.results.length > 0) {
          // Only accept exact matches with reasonable year
          for (const result of searchResultsNoYear.results) {
            const resultTitle = (result.title || '').toLowerCase();
            const resultOriginalTitle = (result.original_title || '').toLowerCase();
            const resultYear = result.release_date ? parseInt(result.release_date.substring(0, 4)) : null;
            const origLower = originalTitle.toLowerCase();
            
            // Skip documentaries/making-of
            if (resultTitle.includes('making of') || 
                resultTitle.includes('behind the scenes') ||
                resultTitle.includes('documentary') ||
                resultTitle.includes('trailer')) {
              continue;
            }
            
            // Only accept exact title match with year within 2 years or in decade
            if ((resultTitle === origLower || resultOriginalTitle === origLower)) {
              if (year && resultYear && Math.abs(resultYear - parseInt(year)) <= 2) {
                bestMatch = result;
                break;
              } else if (!year && decadeStart !== null && resultYear && resultYear >= decadeStart && resultYear <= decadeStart + 9) {
                bestMatch = result;
                break;
              }
            }
          }
          
          if (!bestMatch) {
            log(`❌ No acceptable match found for "${originalTitle}" (expected year: ${year}${decadeStart ? `, decade ${decadeStart}s` : ''})`);
          }
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    // Log which movie was selected for debugging (only if multiple results)
    // Reduced logging for performance
    if (bestMatch && searchResults.some(sr => sr.results?.results?.length > 1)) {
      const totalResults = searchResults.reduce((sum, sr) => sum + (sr.results?.results?.length || 0), 0);
      if (totalResults > 3) {
        log(`🎯 Selected "${bestMatch.title}" (${bestMatch.release_date?.substring(0,4) || 'N/A'}) from ${totalResults} results for "${title}"`);
      }
    }

    const tmdbId = bestMatch.id;
    const fullMovie = await getMovieWithIMDB(tmdbId);
    if (!fullMovie) return null;

    // Log if movie doesn't have IMDB ID (reduced logging for performance)
    // Only log if it's a significant issue

    if (filmtvRating) {
      fullMovie.filmtvRating = filmtvRating;
    }

    return convertTMDBToStremio(fullMovie);
  } catch (error) {
    logError(`Error searching TMDB for ${title}:`, error.message);
    return null;
  }
}


async function scrapeFilmTVList(year) {
  const scrapeStart = Date.now();
  const movies = [];
  const seen = new Set();
  const PAGES_TO_SCRAPE = 2; // Up to 2 pages (40 movies max)
  const MOVIES_PER_PAGE = 20;

  try {
    const initialUrl = `${FILMTV_BASE_URL}/film/migliori/anno-${year}/#`;
    const initialHtml = await fetchWithCache(initialUrl);
    let $ = cheerio.load(initialHtml);

    // Extract loader URL
    const dataExec = $('[data-exec*="loader/film"]').attr('data-exec');
    let loaderUrl = null;

    if (dataExec) {
      const match = dataExec.match(/newlist\('M','(\/\/[^']+)'\)/);
      if (match) {
        loaderUrl = 'https:' + match[1];
        loaderUrl = loaderUrl.replace(/\/\d+\/\d+\/$/, '');
      }
    }

    // Process first page
    $('h3, h2, h4').each((_, elem) => {
      const text = $(elem).text().trim();
      const match = text.match(/^(\d+)\.\s*(.+?)$/);

      if (match) {
        let title = match[2].trim();
        title = title.split('\n')[0].split('\t')[0].trim();

        if (title.length < 3 ||
            title.includes('La recensione') ||
            title.includes('Uscito in Italia') ||
            title.includes('Uscita in Italia') ||
            title.includes('streaming') ||
            title.includes('migliori') ||
            seen.has(title)) {
          return;
        }

        let filmtvRating = null;
        let originalTitle = null;
        const article = $(elem).closest('article, .item-scheda-wrap');
        const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
        if (ratingSpan.length > 0) {
          const ratingText = ratingSpan.text().trim();
          const rating = parseFloat(ratingText);
          if (!isNaN(rating) && rating >= 0 && rating <= 10) {
            filmtvRating = rating;
          }
        }
        
        // Extract original title from the page
        const originalTitleElem = article.find('p.titolo-originale');
        if (originalTitleElem.length > 0) {
          const originalTitleText = originalTitleElem.text().trim();
          // Extract text after "Titolo originale"
          const originalTitleMatch = originalTitleText.match(/Titolo originale\s*(.+)/i);
          if (originalTitleMatch && originalTitleMatch[1]) {
            originalTitle = originalTitleMatch[1].trim();
          }
        }

        seen.add(title);
        movies.push({
          title: title,
          year: year,
          filmtvRating: filmtvRating,
          originalTitle: originalTitle
        });
      }
    });

    // Fetch additional pages with rate limiting
    if (loaderUrl && PAGES_TO_SCRAPE > 1) {
      for (let page = 2; page <= PAGES_TO_SCRAPE; page++) {
        const start = (page - 1) * MOVIES_PER_PAGE;
        const paginatedUrl = `${loaderUrl}/${start}/${MOVIES_PER_PAGE}/`;

        try {
          const data = await fetchWithCache(paginatedUrl);

          if (data && typeof data === 'object' && data.html) {
            $ = cheerio.load(data.html);

            $('h2, h3, h4').each((_, elem) => {
              const text = $(elem).text().trim();
              const match = text.match(/^(\d+)\.\s*(.+?)$/);

              if (match) {
                let title = match[2].trim();
                title = title.split('\n')[0].split('\t')[0].trim();

                if (title.length < 3 ||
                    title.includes('La recensione') ||
                    title.includes('Uscito in Italia') ||
                    title.includes('Uscita in Italia') ||
                    title.includes('streaming') ||
                    title.includes('migliori') ||
                    seen.has(title)) {
                  return;
                }

                  let filmtvRating = null;
                  let originalTitle = null;
                  const article = $(elem).closest('article, .item-scheda-wrap');
                  const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
                  if (ratingSpan.length > 0) {
                    const ratingText = ratingSpan.text().trim();
                    const rating = parseFloat(ratingText);
                    if (!isNaN(rating) && rating >= 0 && rating <= 10) {
                      filmtvRating = rating;
                    }
                  }
                  
                  // Extract original title from the page
                  const originalTitleElem = article.find('p.titolo-originale');
                  if (originalTitleElem.length > 0) {
                    const originalTitleText = originalTitleElem.text().trim();
                    // Extract text after "Titolo originale"
                    const originalTitleMatch = originalTitleText.match(/Titolo originale\s*(.+)/i);
                    if (originalTitleMatch && originalTitleMatch[1]) {
                      originalTitle = originalTitleMatch[1].trim();
                    }
                  }

                  seen.add(title);
                  movies.push({
                    title: title,
                    year: year,
                    filmtvRating: filmtvRating,
                    originalTitle: originalTitle
                  });
              }
            });
          }
        } catch (error) {
          logError(`Error fetching page ${page}:`, error.message);
          // Continue with what we have
          break;
        }
      }
    }

    const scrapeDuration = Date.now() - scrapeStart;
    log(`Scraped ${movies.length} movies from FilmTV.it for ${year} in ${scrapeDuration} ms`);

    return movies;
  } catch (error) {
    logError(`Error scraping FilmTV.it for ${year}:`, error.message);
    return [];
  }
}

// Function to get filtered list from FilmTV
async function getFilteredList(filters) {
  const cacheKey = `catalog_${filters}`;
  const now = Date.now();
  const start = Date.now();

  // Check catalog cache
  if (catalogCache.has(cacheKey)) {
    const { data, timestamp } = catalogCache.get(cacheKey);
    if (data && data.length > 0 && now - timestamp < CACHE_DURATION) {
      log(`✓ Cache hit for ${filters}`);
      return data;
    }
  }

  // Check if request is in flight
  if (inFlightPromises.has(cacheKey)) {
    log(`⏳ Waiting for in-flight request for ${filters}`);
    return inFlightPromises.get(cacheKey);
  }

  // Wrap in rate limiter to prevent too many catalogs processing simultaneously
  const promise = rateLimitedCatalogRequest(async () => {
    try {
      // Track catalog processing
      requestHistory.catalogs.push(Date.now());
      log(`🔄 Fetching fresh catalog for filters: ${filters}`);

      const movies = [];
      const seen = new Set();
      const PAGES_TO_SCRAPE = 2;
      const MOVIES_PER_PAGE = 20;

      const initialUrl = `${FILMTV_BASE_URL}/film/migliori/${filters}/#`;
      const initialHtml = await fetchWithCache(initialUrl);
      let $ = cheerio.load(initialHtml);

      const dataExec = $('[data-exec*="loader/film"]').attr('data-exec');
      let loaderUrl = null;

      if (dataExec) {
        const match = dataExec.match(/newlist\('M','(\/\/[^']+)'\)/);
        if (match) {
          loaderUrl = 'https:' + match[1];
          loaderUrl = loaderUrl.replace(/\/\d+\/\d+\/$/, '');
        }
      }

      // Process first page
      $('h3, h2, h4').each((_, elem) => {
        const text = $(elem).text().trim();
        const match = text.match(/^(\d+)\.\s*(.+?)$/);

        if (match) {
          let title = match[2].trim();
          title = title.split('\n')[0].split('\t')[0].trim();

          if (title.length < 3 ||
              title.includes('La recensione') ||
              title.includes('Uscito in Italia') ||
              title.includes('Uscita in Italia') ||
              title.includes('streaming') ||
              title.includes('migliori') ||
              seen.has(title)) {
            return;
          }

          let filmtvRating = null;
          let originalTitle = null;
          const article = $(elem).closest('article, .item-scheda-wrap');
          const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
          if (ratingSpan.length > 0) {
            const ratingText = ratingSpan.text().trim();
            const rating = parseFloat(ratingText);
            if (!isNaN(rating) && rating >= 0 && rating <= 10) {
              filmtvRating = rating;
            }
          }
          
          // Extract original title from the page
          const originalTitleElem = article.find('p.titolo-originale');
          if (originalTitleElem.length > 0) {
            const originalTitleText = originalTitleElem.text().trim();
            // Extract text after "Titolo originale"
            const originalTitleMatch = originalTitleText.match(/Titolo originale\s*(.+)/i);
            if (originalTitleMatch && originalTitleMatch[1]) {
              originalTitle = originalTitleMatch[1].trim();
            }
          }

          seen.add(title);
          const yearMatch = filters.match(/anno-(\d{4})/);
          const decadeMatch = filters.match(/anni-(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1]) : null;
          const decadeStart = decadeMatch ? parseInt(decadeMatch[1]) : null;

          movies.push({
            title: title,
            year: year,
            decadeStart,
            filmtvRating: filmtvRating,
            originalTitle: originalTitle
          });
        }
      });

      // Fetch additional pages
      if (loaderUrl && PAGES_TO_SCRAPE > 1) {
        for (let page = 2; page <= PAGES_TO_SCRAPE; page++) {
          const start = (page - 1) * MOVIES_PER_PAGE;
          const paginatedUrl = `${loaderUrl}/${start}/${MOVIES_PER_PAGE}/`;

          try {
            const data = await fetchWithCache(paginatedUrl);

            if (data && typeof data === 'object' && data.html) {
              $ = cheerio.load(data.html);

              $('h2, h3, h4').each((_, elem) => {
                const text = $(elem).text().trim();
                const match = text.match(/^(\d+)\.\s*(.+?)$/);

                if (match) {
                  let title = match[2].trim();
                  title = title.split('\n')[0].split('\t')[0].trim();

                  if (title.length < 3 ||
                      title.includes('La recensione') ||
                      title.includes('Uscito in Italia') ||
                      title.includes('Uscita in Italia') ||
                      title.includes('streaming') ||
                      title.includes('migliori') ||
                      seen.has(title)) {
                    return;
                  }

                  let filmtvRating = null;
                  let originalTitle = null;
                  const article = $(elem).closest('article, .item-scheda-wrap');
                  const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
                  if (ratingSpan.length > 0) {
                    const ratingText = ratingSpan.text().trim();
                    const rating = parseFloat(ratingText);
                    if (!isNaN(rating) && rating >= 0 && rating <= 10) {
                      filmtvRating = rating;
                    }
                  }
                  
                  // Extract original title from the page
                  const originalTitleElem = article.find('p.titolo-originale');
                  if (originalTitleElem.length > 0) {
                    const originalTitleText = originalTitleElem.text().trim();
                    // Extract text after "Titolo originale"
                    const originalTitleMatch = originalTitleText.match(/Titolo originale\s*(.+)/i);
                    if (originalTitleMatch && originalTitleMatch[1]) {
                      originalTitle = originalTitleMatch[1].trim();
                    }
                  }

                  seen.add(title);
                  const yearMatch = filters.match(/anno-(\d{4})/);
                  const decadeMatch = filters.match(/anni-(\d{4})/);
                  const year = yearMatch ? parseInt(yearMatch[1]) : null;
                  const decadeStart = decadeMatch ? parseInt(decadeMatch[1]) : null;

                  movies.push({
                    title: title,
                    year: year,
                    decadeStart,
                    filmtvRating: filmtvRating,
                    originalTitle: originalTitle
                  });
                }
              });
            }
          } catch (error) {
            logError(`Error fetching page ${page}:`, error.message);
            break;
          }
        }
      }

      if (movies.length === 0) {
        log(`No movies found for filters: ${filters}`);
        return [];
      }

      // Get TMDB details with parallel processing (optimized)
      const tmdbStart = Date.now();
      let notFoundCount = 0;
      let noImdbIdCount = 0;
      const notFoundTitles = [];
      const noImdbIdTitles = [];
      
      // Process movies in parallel batches for better performance
      const BATCH_SIZE = 10;
      const moviesWithDetails = [];
      
      for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const batch = movies.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (movie) => {
            try {
              let tmdbMovie = await searchMovieOnTMDB(
                movie.title,
                movie.year,
                movie.filmtvRating,
                movie.originalTitle || null,
                movie.decadeStart || null
              );
              
              if (!tmdbMovie) {
                notFoundCount++;
                notFoundTitles.push(movie.title);
              } else if (!tmdbMovie.id || !tmdbMovie.id.startsWith('tt')) {
                noImdbIdCount++;
                noImdbIdTitles.push(tmdbMovie.name || movie.title);
              }
              return tmdbMovie;
            } catch (error) {
              // Reduced error logging for performance
              notFoundCount++;
              notFoundTitles.push(movie.title);
              return null;
            }
          })
        );
        moviesWithDetails.push(...batchResults);
      }

      const results = moviesWithDetails.filter(m => m !== null);
      const tmdbDuration = Date.now() - tmdbStart;
      
      // Log filtering details (reduced verbosity for performance)
      if ((notFoundCount > 0 || noImdbIdCount > 0) && (notFoundCount + noImdbIdCount) > 2) {
        log(`📊 Filtering stats for ${filters}: ${movies.length} scraped, ${results.length} returned`);
        if (notFoundCount > 0) {
          log(`  ❌ Not found on TMDB: ${notFoundCount} (${notFoundTitles.slice(0, 3).join(', ')}${notFoundTitles.length > 3 ? '...' : ''})`);
        }
        if (noImdbIdCount > 0) {
          log(`  ⚠️ No IMDB ID: ${noImdbIdCount} (${noImdbIdTitles.slice(0, 3).join(', ')}${noImdbIdTitles.length > 3 ? '...' : ''})`);
        }
      }

      // Cache in memory only
      catalogCache.set(cacheKey, { data: results, timestamp: now });
      log(`✅ Cached catalog for ${filters} (${results.length} movies)`);

      const totalDuration = Date.now() - start;
      
      // Track response time
      trackResponseTime('catalog', totalDuration, { filters, moviesIn: movies.length, moviesOut: results.length });

      log(`⏱️ getFilteredList ${filters}: total ${totalDuration} ms, tmdb ${tmdbDuration} ms, movies in ${movies.length}, out ${results.length}`);

      return results;
    } catch (error) {
      logError('Error fetching filtered list:', error.message);

      return [];
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  });

  inFlightPromises.set(cacheKey, promise);
  return promise;
}

async function getBestOfYear(year) {
  const cacheKey = `catalog_${year}`;
  const now = Date.now();
  const start = Date.now();

  if (catalogCache.has(cacheKey)) {
    const { data, timestamp } = catalogCache.get(cacheKey);
    if (data && data.length > 0 && now - timestamp < CACHE_DURATION) {
      log(`✓ Cache hit for ${year}`);
      return data;
    }
  }

  if (inFlightPromises.has(cacheKey)) {
    log(`⏳ Waiting for in-flight request for ${year}`);
    return inFlightPromises.get(cacheKey);
  }

  // Wrap in rate limiter to prevent too many catalogs processing simultaneously
  const promise = rateLimitedCatalogRequest(async () => {
    try {
      // Track catalog processing
      requestHistory.catalogs.push(Date.now());
      log(`🔄 Fetching fresh catalog for ${year}`);

      const filmtvMovies = await scrapeFilmTVList(year);

      if (filmtvMovies.length === 0) {
        return [];
      }

      // Get TMDB details with parallel processing (optimized)
      const tmdbStart = Date.now();
      let notFoundCount = 0;
      let noImdbIdCount = 0;
      const notFoundTitles = [];
      const noImdbIdTitles = [];
      
      // Process movies in parallel batches for better performance
      const BATCH_SIZE = 10;
      const moviesWithDetails = [];
      
      for (let i = 0; i < filmtvMovies.length; i += BATCH_SIZE) {
        const batch = filmtvMovies.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (movie) => {
            try {
              let tmdbMovie = await searchMovieOnTMDB(
                movie.title,
                movie.year,
                movie.filmtvRating,
                movie.originalTitle || null,
                movie.decadeStart || null
              );
              
              if (!tmdbMovie) {
                notFoundCount++;
                notFoundTitles.push(movie.title);
              } else if (!tmdbMovie.id || !tmdbMovie.id.startsWith('tt')) {
                noImdbIdCount++;
                noImdbIdTitles.push(tmdbMovie.name || movie.title);
              }
              return tmdbMovie;
            } catch (error) {
              // Reduced error logging for performance
              notFoundCount++;
              notFoundTitles.push(movie.title);
              return null;
            }
          })
        );
        moviesWithDetails.push(...batchResults);
      }

      const results = moviesWithDetails.filter(m => m !== null);
      const tmdbDuration = Date.now() - tmdbStart;
      
      // Log filtering details
      if (notFoundCount > 0 || noImdbIdCount > 0) {
        log(`📊 Filtering stats for ${year}: ${filmtvMovies.length} scraped, ${results.length} returned`);
        if (notFoundCount > 0) {
          log(`  ❌ Not found on TMDB: ${notFoundCount} (${notFoundTitles.slice(0, 3).join(', ')}${notFoundTitles.length > 3 ? '...' : ''})`);
        }
        if (noImdbIdCount > 0) {
          log(`  ⚠️ No IMDB ID: ${noImdbIdCount} (${noImdbIdTitles.slice(0, 3).join(', ')}${noImdbIdTitles.length > 3 ? '...' : ''})`);
        }
      }

      // Cache in memory only
      catalogCache.set(cacheKey, { data: results, timestamp: now });
      log(`✅ Cached catalog for ${year} (${results.length} movies)`);

      const totalDuration = Date.now() - start;
      
      // Track response time
      trackResponseTime('catalog', totalDuration, { year, moviesIn: filmtvMovies.length, moviesOut: results.length });

      log(`⏱️ getBestOfYear ${year}: total ${totalDuration} ms, tmdb ${tmdbDuration} ms, movies in ${filmtvMovies.length}, out ${results.length}`);

      return results;
    } catch (error) {
      logError('Error fetching best of year:', error.message);

      return [];
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  });

  inFlightPromises.set(cacheKey, promise);
  return promise;
}

async function getAllLists() {
  return [
    { id: 'best-2025', name: 'Best of 2025', year: 2025 },
    { id: 'best-2024', name: 'Best of 2024', year: 2024 },
    { id: 'best-2023', name: 'Best of 2023', year: 2023 },
  ];
}

// Helper function to find a movie by IMDB ID in cached catalogs
function getMovieByImdbId(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt')) {
    return null;
  }

  // Search through all cached catalogs
  for (const [cacheKey, cacheData] of catalogCache.entries()) {
    if (cacheData && cacheData.data && Array.isArray(cacheData.data)) {
      const movie = cacheData.data.find(m => m && m.id === imdbId);
      if (movie) {
        log(`✓ Found movie ${imdbId} in cached catalog ${cacheKey}`);
        return movie;
      }
    }
  }

  log(`✗ Movie ${imdbId} not found in any cached catalog`);
  return null;
}

// Fetch movie by IMDB ID directly from TMDB (fallback when not in cache)
async function getMovieByImdbIdFromTMDB(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt') || !TMDB_API_KEY) {
    return null;
  }

  try {
    // Find TMDB ID by IMDB ID
    const findResult = await fetchFromTMDB(`/find/${imdbId}`, {
      external_source: 'imdb_id',
      language: 'it-IT'
    });

    const movieResult = (findResult && findResult.movie_results && findResult.movie_results[0]) || null;
    if (!movieResult) {
      return null;
    }

    // Get full movie details (with external_ids) to ensure IMDB ID is present
    const fullMovie = await getMovieWithIMDB(movieResult.id);
    if (!fullMovie) {
      return null;
    }

    return convertTMDBToStremio(fullMovie);
  } catch (error) {
    logError(`Error fetching movie by IMDB ID ${imdbId} from TMDB:`, error.message);
    return null;
  }
}

// Pre-warm popular catalogs on startup
async function prewarmPopularCatalogs() {
  if (!TMDB_API_KEY) {
    log('⚠️ Cannot pre-warm catalogs: No TMDB API key available');
    return;
  }
  
  log('🔥 Pre-warming popular catalogs...');
  const popularCatalogs = [
    'anno-2025',
    'anno-2024',
    'anno-2023',
    'anni-2020',
    'anni-2010'
  ];
  
  // Pre-warm in batches of 2 to avoid overwhelming on startup
  for (let i = 0; i < popularCatalogs.length; i += 2) {
    const batch = popularCatalogs.slice(i, i + 2);
    await Promise.all(batch.map(async (filter) => {
      try {
        const start = Date.now();
        await getFilteredList(filter);
        const duration = Date.now() - start;
        log(`✅ Pre-warmed ${filter} in ${duration}ms`);
      } catch (error) {
        logError(`❌ Failed to pre-warm ${filter}:`, error.message);
      }
    }));
  }
  
  log('✅ Pre-warming complete');
}

// Background cache refresh for popular catalogs
let cacheRefreshInterval = null;

function startCacheRefresh() {
  if (cacheRefreshInterval) {
    clearInterval(cacheRefreshInterval);
  }
  
  // Refresh caches every 90 minutes (before 2 hour expiry)
  cacheRefreshInterval = setInterval(async () => {
    if (!TMDB_API_KEY) return;
    
    log('🔄 Background cache refresh started...');
    const popularCatalogs = [
      'anno-2025',
      'anno-2024',
      'anno-2023'
    ];
    
    // Refresh in background (low priority)
    popularCatalogs.forEach(async (filter) => {
      try {
        // Check if cache is getting old (> 1.5 hours)
        const cacheKey = `catalog_${filter}`;
        if (catalogCache.has(cacheKey)) {
          const { timestamp } = catalogCache.get(cacheKey);
          const age = Date.now() - timestamp;
          if (age > (1000 * 60 * 90)) { // 90 minutes
            log(`🔄 Refreshing cache for ${filter}...`);
            await getFilteredList(filter);
          }
        }
      } catch (error) {
        // Silent fail for background refresh
      }
    });
  }, 1000 * 60 * 30); // Check every 30 minutes
  
  log('🔄 Background cache refresh scheduled (every 30 minutes)');
}

function stopCacheRefresh() {
  if (cacheRefreshInterval) {
    clearInterval(cacheRefreshInterval);
    cacheRefreshInterval = null;
  }
}

module.exports = {
  getBestOfYear,
  getFilteredList,
  getAllLists,
  setTMDBApiKey,
  getMovieByImdbId,
  getMovieByImdbIdFromTMDB,
  prewarmPopularCatalogs,
  startCacheRefresh,
  stopCacheRefresh,
  getResponseTimeStats,
  trackResponseTime
};

