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
// Faster on Railway: more TMDB parallelism, shorter delay
const REQUEST_DELAY = 150; // delay between requests (ms)
const MAX_CONCURRENT_REQUESTS = 6; // TMDB/http requests in parallel
const MAX_CONCURRENT_CATALOGS = 3; // catalogs processed simultaneously
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
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Catalog cache (in-memory only)
const catalogCache = new Map();

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
        timeout: 8000, // 8 second timeout (reduced to prevent resource exhaustion)
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
        timeout: 8000, // 8 second timeout (reduced to prevent resource exhaustion)
        headers: {
          'Accept': 'application/json'
        }
      });

      cache.set(cacheKey, { data: response.data, timestamp: now });
      return response.data;
    } catch (error) {
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
    log(`Skipping movie without valid IMDB ID: ${tmdbMovie.title}`);
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
function findBestMatch(searchResults, searchTitle, searchYear, originalTitle = null) {
  if (!searchResults.results || searchResults.results.length === 0) {
    return null;
  }

  const searchYearNum = searchYear ? parseInt(searchYear) : null;
  let bestMatch = null;
  let bestScore = -1;

  for (const result of searchResults.results) {
    let score = 0;
    const resultTitle = result.title || '';
    const resultYear = result.release_date ? parseInt(result.release_date.substring(0, 4)) : null;
    const titleLower = resultTitle.toLowerCase();

    // Skip documentaries, making-of, trailers, etc. (they often don't have IMDB IDs)
    if (titleLower.includes('making of') || 
        titleLower.includes('behind the scenes') ||
        titleLower.includes('documentary') ||
        titleLower.includes('trailer') ||
        titleLower.includes('the making of')) {
      continue;
    }

    // Exact title match gets highest score - prefer original title if available
    if (originalTitle && resultTitle.toLowerCase() === originalTitle.toLowerCase()) {
      score += 200; // Highest priority for exact original title match
    } else if (resultTitle.toLowerCase() === searchTitle.toLowerCase()) {
      score += 100;
    } else {
      // Partial match - check if search title is contained in result title or vice versa
      const searchLower = searchTitle.toLowerCase();
      const resultLower = resultTitle.toLowerCase();
      if (resultLower.includes(searchLower) || searchLower.includes(resultLower)) {
        score += 50;
      }
    }

    // Year match adds significant score
    if (searchYearNum && resultYear === searchYearNum) {
      score += 30;
    } else if (searchYearNum && resultYear && Math.abs(resultYear - searchYearNum) <= 1) {
      // Within 1 year is still good
      score += 10;
    }

    // Prefer results with higher popularity if scores are similar
    score += Math.min(result.popularity || 0, 10);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  // If we have a good match (score > 50), use it
  // Otherwise, fall back to first result if no good match found
  return bestMatch || searchResults.results[0];
}

async function searchMovieOnTMDB(title, year, filmtvRating = null, originalTitle = null) {
  try {
    // First try with Italian title
    let searchResults = await fetchFromTMDB('/search/movie', {
      query: title,
      year: year,
      include_adult: false
    });

    // If no results and we have original title, try with that
    if ((!searchResults.results || searchResults.results.length === 0) && originalTitle && originalTitle !== title) {
      log(`🔄 Retrying search with original title: ${originalTitle} (was: ${title})`);
      searchResults = await fetchFromTMDB('/search/movie', {
        query: originalTitle,
        year: year,
        include_adult: false
      });
      
      // If still no results, try without year filter (more flexible)
      if (!searchResults.results || searchResults.results.length === 0) {
        searchResults = await fetchFromTMDB('/search/movie', {
          query: originalTitle,
          include_adult: false
        });
      }
    }

    if (!searchResults.results || searchResults.results.length === 0) {
      return null;
    }

    // Find the best matching result
    const bestMatch = findBestMatch(searchResults, originalTitle || title, year, originalTitle);
    if (!bestMatch) {
      return null;
    }

    // Log which movie was selected for debugging
    if (searchResults.results.length > 1) {
      log(`🎯 Selected "${bestMatch.title}" (${bestMatch.release_date?.substring(0,4) || 'N/A'}) from ${searchResults.results.length} results for "${title}"`);
    }

    const tmdbId = bestMatch.id;
    const fullMovie = await getMovieWithIMDB(tmdbId);
    if (!fullMovie) return null;

    // Log if movie doesn't have IMDB ID
    if (!fullMovie.imdb_id || !fullMovie.imdb_id.startsWith('tt')) {
      log(`⚠️ Movie "${fullMovie.title}" (TMDB ID: ${tmdbId}) found but has no IMDB ID`);
    }

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
          const match = originalTitleText.match(/Titolo originale\s*(.+)/i);
          if (match && match[1]) {
            originalTitle = match[1].trim();
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
                    const match = originalTitleText.match(/Titolo originale\s*(.+)/i);
                    if (match && match[1]) {
                      originalTitle = match[1].trim();
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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'perf1',hypothesisId:'H4',location:'scraper-safe.js:scrapeFilmTVList',message:'scrape duration',data:{year,count:movies.length,durationMs:scrapeDuration},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'scraper-safe.js:getFilteredList',message:'entry getFilteredList',data:{cacheKey},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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
            const match = originalTitleText.match(/Titolo originale\s*(.+)/i);
            if (match && match[1]) {
              originalTitle = match[1].trim();
            }
          }

          seen.add(title);
          const yearMatch = filters.match(/anno-(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

          movies.push({
            title: title,
            year: year,
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
                    const match = originalTitleText.match(/Titolo originale\s*(.+)/i);
                    if (match && match[1]) {
                      originalTitle = match[1].trim();
                    }
                  }

                  seen.add(title);
                  const yearMatch = filters.match(/anno-(\d{4})/);
                  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

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
            break;
          }
        }
      }

      if (movies.length === 0) {
        log(`No movies found for filters: ${filters}`);
        return [];
      }

      // Get TMDB details with rate limiting
      const tmdbStart = Date.now();
      let notFoundCount = 0;
      let noImdbIdCount = 0;
      const notFoundTitles = [];
      const noImdbIdTitles = [];
      
      const moviesWithDetails = await Promise.all(
        movies.map(async (movie) => {
          try {
            // First try with Italian title, then with original title if available
            let tmdbMovie = await searchMovieOnTMDB(movie.title, movie.year, movie.filmtvRating, movie.originalTitle || null);
            
            if (!tmdbMovie) {
              notFoundCount++;
              notFoundTitles.push(movie.title);
            } else if (!tmdbMovie.imdb_id || !tmdbMovie.imdb_id.startsWith('tt')) {
              noImdbIdCount++;
              noImdbIdTitles.push(tmdbMovie.title || movie.title);
            }
            return tmdbMovie;
          } catch (error) {
            logError(`Error processing ${movie.title}:`, error.message);
            notFoundCount++;
            notFoundTitles.push(movie.title);
            return null;
          }
        })
      );

      const results = moviesWithDetails.filter(m => m !== null);
      const tmdbDuration = Date.now() - tmdbStart;
      
      // Log filtering details
      if (notFoundCount > 0 || noImdbIdCount > 0) {
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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'scraper-safe.js:getFilteredList',message:'success getFilteredList',data:{cacheKey,count:results.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'perf1',hypothesisId:'H5',location:'scraper-safe.js:getFilteredList',message:'perf getFilteredList',data:{cacheKey,totalDurationMs:totalDuration,tmdbDurationMs:tmdbDuration,moviesInput:movies.length,moviesOutput:results.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      log(`⏱️ getFilteredList ${filters}: total ${totalDuration} ms, tmdb ${tmdbDuration} ms, movies in ${movies.length}, out ${results.length}`);

      return results;
    } catch (error) {
      logError('Error fetching filtered list:', error.message);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'scraper-safe.js:getFilteredList',message:'error getFilteredList',data:{cacheKey,error:error.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'scraper-safe.js:getBestOfYear',message:'entry getBestOfYear',data:{cacheKey},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

      // Get TMDB details with rate limiting
      const tmdbStart = Date.now();
      let notFoundCount = 0;
      let noImdbIdCount = 0;
      const notFoundTitles = [];
      const noImdbIdTitles = [];
      
      const moviesWithDetails = await Promise.all(
        filmtvMovies.map(async (movie) => {
          try {
            // First try with Italian title, then with original title if available
            let tmdbMovie = await searchMovieOnTMDB(movie.title, movie.year, movie.filmtvRating, movie.originalTitle || null);
            
            if (!tmdbMovie) {
              notFoundCount++;
              notFoundTitles.push(movie.title);
            } else if (!tmdbMovie.imdb_id || !tmdbMovie.imdb_id.startsWith('tt')) {
              noImdbIdCount++;
              noImdbIdTitles.push(tmdbMovie.title || movie.title);
            }
            return tmdbMovie;
          } catch (error) {
            logError(`Error processing ${movie.title}:`, error.message);
            notFoundCount++;
            notFoundTitles.push(movie.title);
            return null;
          }
        })
      );

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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'scraper-safe.js:getBestOfYear',message:'success getBestOfYear',data:{cacheKey,count:results.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'perf1',hypothesisId:'H5',location:'scraper-safe.js:getBestOfYear',message:'perf getBestOfYear',data:{cacheKey,totalDurationMs:totalDuration,tmdbDurationMs:tmdbDuration,moviesInput:filmtvMovies.length,moviesOutput:results.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      log(`⏱️ getBestOfYear ${year}: total ${totalDuration} ms, tmdb ${tmdbDuration} ms, movies in ${filmtvMovies.length}, out ${results.length}`);

      return results;
    } catch (error) {
      logError('Error fetching best of year:', error.message);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'scraper-safe.js:getBestOfYear',message:'error getBestOfYear',data:{cacheKey,error:error.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

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

module.exports = {
  getBestOfYear,
  getFilteredList,
  getAllLists,
  setTMDBApiKey
};

