const axios = require('axios');

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY_HERE';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Cache to avoid repeated requests
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

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

async function getBestOfYear(year) {
  try {
    // Fetch top rated movies from that year
    const response = await fetchFromTMDB('/discover/movie', {
      primary_release_year: year,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100, // Only include movies with at least 100 votes
      region: 'IT' // Prioritize Italian releases
    });

    if (!response.results || response.results.length === 0) {
      return [];
    }

    // Get full details with IMDB IDs for each movie
    const moviesWithDetails = await Promise.all(
      response.results.slice(0, 20).map(async (movie) => {
        const fullMovie = await getMovieWithIMDB(movie.id);
        return fullMovie ? convertTMDBToStremio(fullMovie) : null;
      })
    );

    return moviesWithDetails.filter(m => m !== null);
  } catch (error) {
    console.error('Error fetching best of year:', error.message);
    return [];
  }
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
