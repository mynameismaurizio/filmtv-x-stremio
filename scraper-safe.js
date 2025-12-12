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

// Rate limiting configuration - AGGRESSIVE to prevent resource exhaustion
const REQUEST_DELAY = 1000; // 1 second delay between requests (increased from 500ms)
const MAX_CONCURRENT_REQUESTS = 1; // Only 1 request at a time (reduced from 3)
const MAX_CONCURRENT_CATALOGS = 2; // Max 2 catalog requests processing simultaneously
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

async function searchMovieOnTMDB(title, year, filmtvRating = null) {
  try {
    const searchResults = await fetchFromTMDB('/search/movie', {
      query: title,
      year: year,
      include_adult: false
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      return null;
    }

    const tmdbId = searchResults.results[0].id;
    const fullMovie = await getMovieWithIMDB(tmdbId);
    if (!fullMovie) return null;

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
  const movies = [];
  const seen = new Set();
  const PAGES_TO_SCRAPE = 2; // Limit to 2 pages (40 movies max)
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
        const article = $(elem).closest('article');
        const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
        if (ratingSpan.length > 0) {
          const ratingText = ratingSpan.text().trim();
          const rating = parseFloat(ratingText);
          if (!isNaN(rating) && rating >= 0 && rating <= 10) {
            filmtvRating = rating;
          }
        }

        seen.add(title);
        movies.push({
          title: title,
          year: year,
          filmtvRating: filmtvRating
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
                const article = $(elem).closest('article');
                const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
                if (ratingSpan.length > 0) {
                  const ratingText = ratingSpan.text().trim();
                  const rating = parseFloat(ratingText);
                  if (!isNaN(rating) && rating >= 0 && rating <= 10) {
                    filmtvRating = rating;
                  }
                }

                seen.add(title);
                movies.push({
                  title: title,
                  year: year,
                  filmtvRating: filmtvRating
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

    log(`Scraped ${movies.length} movies from FilmTV.it for ${year}`);
    return movies;
  } catch (error) {
    logError(`Error scraping FilmTV.it for ${year}:`, error.message);
    return [];
  }
}

// Function to get filtered list from FilmTV
async function getFilteredList(filters) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraper-safe.js:416',message:'getFilteredList entry',data:{filters},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  const cacheKey = `catalog_${filters}`;
  const now = Date.now();

  // Check catalog cache
  if (catalogCache.has(cacheKey)) {
    const { data, timestamp } = catalogCache.get(cacheKey);
    if (data && data.length > 0 && now - timestamp < CACHE_DURATION) {
      log(`✓ Cache hit for ${filters}`);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraper-safe.js:424',message:'Cache hit',data:{filters,count:data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return data;
    }
  }

  // Check if request is in flight
  if (inFlightPromises.has(cacheKey)) {
    log(`⏳ Waiting for in-flight request for ${filters}`);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraper-safe.js:432',message:'Waiting for in-flight',data:{filters},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return inFlightPromises.get(cacheKey);
  }

  // Wrap in rate limiter to prevent too many catalogs processing simultaneously
  return rateLimitedCatalogRequest(async () => {
    const promise = (async () => {
    try {
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
          const article = $(elem).closest('article');
          const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
          if (ratingSpan.length > 0) {
            const ratingText = ratingSpan.text().trim();
            const rating = parseFloat(ratingText);
            if (!isNaN(rating) && rating >= 0 && rating <= 10) {
              filmtvRating = rating;
            }
          }

          seen.add(title);
          const yearMatch = filters.match(/anno-(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

          movies.push({
            title: title,
            year: year,
            filmtvRating: filmtvRating
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
                  const article = $(elem).closest('article');
                  const ratingSpan = article.find('footer [data-updcnt^="voto-ftv-film"]').first();
                  if (ratingSpan.length > 0) {
                    const ratingText = ratingSpan.text().trim();
                    const rating = parseFloat(ratingText);
                    if (!isNaN(rating) && rating >= 0 && rating <= 10) {
                      filmtvRating = rating;
                    }
                  }

                  seen.add(title);
                  const yearMatch = filters.match(/anno-(\d{4})/);
                  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

                  movies.push({
                    title: title,
                    year: year,
                    filmtvRating: filmtvRating
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
      const moviesWithDetails = await Promise.all(
        movies.map(async (movie) => {
          try {
            const tmdbMovie = await searchMovieOnTMDB(movie.title, movie.year, movie.filmtvRating);
            return tmdbMovie;
          } catch (error) {
            logError(`Error processing ${movie.title}:`, error.message);
            return null;
          }
        })
      );

      const results = moviesWithDetails.filter(m => m !== null);

      // Cache in memory only
      catalogCache.set(cacheKey, { data: results, timestamp: now });
      log(`✅ Cached catalog for ${filters} (${results.length} movies)`);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraper-safe.js:595',message:'getFilteredList success',data:{filters,resultsCount:results.length,firstResult:results[0]?Object.keys(results[0]):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      return results;
    } catch (error) {
      logError('Error fetching filtered list:', error.message);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraper-safe.js:600',message:'getFilteredList error',data:{filters,errorMessage:error.message,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return [];
    } finally {
      inFlightPromises.delete(cacheKey);
    }
    })();

    inFlightPromises.set(cacheKey, promise);
    return promise;
  });
}

async function getBestOfYear(year) {
  const cacheKey = `catalog_${year}`;
  const now = Date.now();

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
  return rateLimitedCatalogRequest(async () => {
    const promise = (async () => {
    try {
      log(`🔄 Fetching fresh catalog for ${year}`);

      const filmtvMovies = await scrapeFilmTVList(year);

      if (filmtvMovies.length === 0) {
        return [];
      }

      // Get TMDB details with rate limiting
      const moviesWithDetails = await Promise.all(
        filmtvMovies.map(async (movie) => {
          try {
            const tmdbMovie = await searchMovieOnTMDB(movie.title, movie.year, movie.filmtvRating);
            return tmdbMovie;
          } catch (error) {
            logError(`Error processing ${movie.title}:`, error.message);
            return null;
          }
        })
      );

      const results = moviesWithDetails.filter(m => m !== null);

      // Cache in memory only
      catalogCache.set(cacheKey, { data: results, timestamp: now });
      log(`✅ Cached catalog for ${year} (${results.length} movies)`);

      return results;
    } catch (error) {
      logError('Error fetching best of year:', error.message);
      return [];
    } finally {
      inFlightPromises.delete(cacheKey);
    }
    })();

    inFlightPromises.set(cacheKey, promise);
    return promise;
  });
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

