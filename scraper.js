const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.filmtv.it';

// Cache to avoid repeated requests
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

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

function parseMovieCard($, element) {
  const card = $(element);

  // Extract title
  const titleLink = card.find('a[href*="/film/"]').first();
  const title = titleLink.text().trim();
  const href = titleLink.attr('href');

  if (!href) return null;

  // Extract film ID from URL
  const filmIdMatch = href.match(/\/film\/(\d+)\//);
  const filmId = filmIdMatch ? filmIdMatch[1] : null;

  if (!filmId) return null;

  // Extract rating
  const ratingText = card.find('span').filter(function() {
    return /^\d+(\.\d+)?$/.test($(this).text().trim());
  }).first().text().trim();
  const rating = ratingText ? parseFloat(ratingText) : null;

  // Extract metadata (genre, year, country, duration, director, cast)
  const metaItems = card.find('li').toArray();
  let genre = null;
  let year = null;
  let country = null;
  let duration = null;
  let director = null;
  let cast = [];

  metaItems.forEach(item => {
    const text = $(item).text().trim();

    // Year and country (e.g., "USA 2025")
    const yearMatch = text.match(/(\d{4})/);
    if (yearMatch && !year) {
      year = yearMatch[1];
      country = text.replace(yearMatch[0], '').trim();
    }

    // Duration
    const durationMatch = text.match(/durata\s+(\d+)'/);
    if (durationMatch) {
      duration = parseInt(durationMatch[1]);
    }

    // Director
    if (text.includes('Regia di')) {
      director = text.replace('Regia di', '').trim();
    }

    // Cast
    if (text.includes('Con ')) {
      const castText = text.replace('Con ', '');
      cast = castText.split(',').map(c => c.trim()).filter(c => c);
    }

    // Genre (first metadata item usually)
    if (!genre && !text.match(/\d/) && !text.includes('di') && !text.includes('Con')) {
      genre = text;
    }
  });

  // Extract poster
  const posterImg = card.find('img').first();
  let poster = posterImg.attr('src') || posterImg.attr('data-src');
  if (poster && !poster.startsWith('http')) {
    poster = poster.startsWith('//') ? 'https:' + poster : BASE_URL + poster;
  }

  return {
    id: `filmtv_${filmId}`,
    type: 'movie',
    name: title,
    poster: poster,
    posterShape: 'poster',
    rating: rating,
    year: year,
    genre: genre ? [genre] : [],
    director: director ? [director] : [],
    cast: cast,
    runtime: duration ? `${duration} min` : null,
    country: country,
    filmtvId: filmId,
    filmtvUrl: href.startsWith('http') ? href : BASE_URL + href
  };
}

async function getBestOfYear(year) {
  const url = `${BASE_URL}/film/migliori/anno-${year}/#`;

  try {
    const html = await fetchWithCache(url);
    const $ = cheerio.load(html);

    const movies = [];

    // Find all movie cards - adjust selector based on actual HTML structure
    // This is a generic approach that looks for links to film pages
    $('a[href*="/film/"]').each((i, elem) => {
      const parent = $(elem).parent().parent(); // Adjust based on actual structure
      const movie = parseMovieCard($, parent);
      if (movie && !movies.find(m => m.id === movie.id)) {
        movies.push(movie);
      }
    });

    return movies;
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
