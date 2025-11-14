const axios = require('axios');
const cheerio = require('cheerio');

// FilmTV.it configuration
const FILMTV_BASE_URL = 'https://www.filmtv.it';

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY_HERE';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Cache to avoid repeated requests
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Catalog cache to avoid re-processing
const catalogCache = new Map();
// In-flight promises to prevent duplicate concurrent requests
const inFlightPromises = new Map();

async function fetchWithCache(url) {
  const now = Date.now();
  if (cache.has(url)) {
    const { data, timestamp } = cache.get(url);
    if (now - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  cache.set(url, { data: response.data, timestamp: now });
  return response.data;
}

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

  try {
    const response = await axios.get(url, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'it-IT',
        ...params
      }
    });

    cache.set(cacheKey, { data: response.data, timestamp: now });
    return response.data;
  } catch (error) {
    console.error('TMDB API Error:', error.message);
    throw error;
  }
}

function convertTMDBToStremio(tmdbMovie) {
  if (!tmdbMovie) return null;

  // TMDB uses numeric IDs, but we need IMDB IDs for Stremio
  // We'll fetch the IMDB ID separately if needed
  const imdbId = tmdbMovie.imdb_id || `tt${tmdbMovie.id}`;

  return {
    id: imdbId,
    type: 'movie',
    name: tmdbMovie.title,
    poster: tmdbMovie.poster_path ? `${TMDB_IMAGE_BASE}${tmdbMovie.poster_path}` : null,
    posterShape: 'poster',
    background: tmdbMovie.backdrop_path ? `${TMDB_IMAGE_BASE}${tmdbMovie.backdrop_path}` : null,
    logo: tmdbMovie.poster_path ? `${TMDB_IMAGE_BASE}${tmdbMovie.poster_path}` : null,
    description: tmdbMovie.overview || '',
    releaseInfo: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : null,
    imdbRating: tmdbMovie.vote_average ? tmdbMovie.vote_average.toFixed(1) : null,
    genres: tmdbMovie.genres ? tmdbMovie.genres.map(g => g.name) : (tmdbMovie.genre_ids ? [] : []),
    runtime: tmdbMovie.runtime ? `${tmdbMovie.runtime} min` : null,
    country: tmdbMovie.production_countries && tmdbMovie.production_countries.length > 0
      ? tmdbMovie.production_countries[0].iso_3166_1
      : null
  };
}

async function getMovieWithIMDB(tmdbId) {
  // Fetch full movie details including IMDB ID
  try {
    const movieDetails = await fetchFromTMDB(`/movie/${tmdbId}`, {
      append_to_response: 'external_ids'
    });

    return {
      ...movieDetails,
      imdb_id: movieDetails.external_ids?.imdb_id || null
    };
  } catch (error) {
    console.error(`Error fetching movie ${tmdbId}:`, error.message);
    return null;
  }
}

async function searchMovieOnTMDB(title, year) {
  try {
    // Search for the movie on TMDB by title and year
    const searchResults = await fetchFromTMDB('/search/movie', {
      query: title,
      year: year,
      include_adult: false
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      console.log(`No TMDB results for: ${title} (${year})`);
      return null;
    }

    // Get the first result (most relevant)
    const tmdbId = searchResults.results[0].id;

    // Fetch full movie details including IMDB ID
    const fullMovie = await getMovieWithIMDB(tmdbId);
    return fullMovie ? convertTMDBToStremio(fullMovie) : null;
  } catch (error) {
    console.error(`Error searching TMDB for ${title}:`, error.message);
    return null;
  }
}

async function scrapeFilmTVList(year) {
  const url = `${FILMTV_BASE_URL}/film/migliori/anno-${year}/#`;

  try {
    const html = await fetchWithCache(url);
    const $ = cheerio.load(html);

    const movies = [];
    const seen = new Set();

    // Find all numbered movie entries like "1.Movie Title"
    $('h3, h2, h4').each((_, elem) => {
      const text = $(elem).text().trim();

      // Match numbered entries like "1.Title" at the start
      const match = text.match(/^(\d+)\.\s*(.+?)$/);

      if (match) {
        let title = match[2].trim();

        // Remove everything after newline or tab
        title = title.split('\n')[0].split('\t')[0].trim();

        // Skip if it's not a valid title
        if (title.length < 3 ||
            title.includes('La recensione') ||
            title.includes('Uscito in Italia') ||
            title.includes('Uscita in Italia') ||
            title.includes('streaming') ||
            title.includes('migliori') ||
            seen.has(title)) {
          return;
        }

        seen.add(title);
        movies.push({
          title: title,
          year: year
        });
      }
    });

    console.log(`Scraped ${movies.length} movies from FilmTV.it for ${year}`);
    return movies.slice(0, 30); // Limit to 30 movies
  } catch (error) {
    console.error(`Error scraping FilmTV.it for ${year}:`, error.message);
    return [];
  }
}

async function getBestOfYear(year) {
  const cacheKey = `catalog_${year}`;
  const now = Date.now();

  // Check catalog cache first
  if (catalogCache.has(cacheKey)) {
    const { data, timestamp } = catalogCache.get(cacheKey);
    if (now - timestamp < CACHE_DURATION) {
      // Cache hit - return silently (no log spam)
      return data;
    }
  }

  // Check if there's already a request in flight for this year
  if (inFlightPromises.has(cacheKey)) {
    console.log(`⏳ Waiting for in-flight request for ${year}`);
    return inFlightPromises.get(cacheKey);
  }

  // Create a new promise for this request
  const promise = (async () => {
    try {
      console.log(`🔄 Fetching fresh catalog for ${year}`);

      // Step 1: Scrape movie titles from FilmTV.it
      const filmtvMovies = await scrapeFilmTVList(year);

      if (filmtvMovies.length === 0) {
        console.log(`No movies found on FilmTV.it for ${year}`);
        return [];
      }

      // Step 2: For each movie, search TMDB to get IMDB ID and metadata
      const moviesWithDetails = await Promise.all(
        filmtvMovies.map(async (movie) => {
          const tmdbMovie = await searchMovieOnTMDB(movie.title, movie.year);
          if (tmdbMovie) {
            console.log(`✓ Found on TMDB: ${movie.title}`);
          } else {
            console.log(`✗ Not found on TMDB: ${movie.title}`);
          }
          return tmdbMovie;
        })
      );

      const results = moviesWithDetails.filter(m => m !== null);

      // Cache the processed catalog
      catalogCache.set(cacheKey, { data: results, timestamp: now });
      console.log(`✅ Cached catalog for ${year} (${results.length} movies)`);

      return results;
    } catch (error) {
      console.error('Error fetching best of year:', error.message);
      return [];
    } finally {
      // Remove from in-flight promises when done
      inFlightPromises.delete(cacheKey);
    }
  })();

  // Store the promise so concurrent requests can wait for it
  inFlightPromises.set(cacheKey, promise);

  return promise;
}

async function getAllLists() {
  // Return available catalog lists
  return [
    { id: 'best-2025', name: 'Best of 2025', year: 2025 },
    { id: 'best-2024', name: 'Best of 2024', year: 2024 },
    { id: 'best-2023', name: 'Best of 2023', year: 2023 },
  ];
}

module.exports = {
  getBestOfYear,
  getAllLists
};
