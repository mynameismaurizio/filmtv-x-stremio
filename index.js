const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getAllLists } = require('./scraper');

// Define the addon manifest
const manifest = {
  id: 'community.filmtv.it',
  version: '1.0.0',
  name: 'FilmTV.it Lists',
  description: 'Browse curated movie lists from FilmTV.it including best movies by year',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  catalogs: [
    {
      type: 'movie',
      id: 'filmtv-best-2025',
      name: 'FilmTV.it - Best of 2025',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'movie',
      id: 'filmtv-best-2024',
      name: 'FilmTV.it - Best of 2024',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'movie',
      id: 'filmtv-best-2023',
      name: 'FilmTV.it - Best of 2023',
      extra: [{ name: 'skip', isRequired: false }]
    }
  ],
  idPrefixes: ['filmtv_']
};

const builder = new addonBuilder(manifest);

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  console.log(`Catalog request: type=${type}, id=${id}`);

  if (type !== 'movie') {
    return { metas: [] };
  }

  let year;
  switch (id) {
    case 'filmtv-best-2025':
      year = 2025;
      break;
    case 'filmtv-best-2024':
      year = 2024;
      break;
    case 'filmtv-best-2023':
      year = 2023;
      break;
    default:
      return { metas: [] };
  }

  try {
    const movies = await getBestOfYear(year);
    console.log(`Found ${movies.length} movies for ${year}`);

    // Movies are already in Stremio format from TMDB scraper
    return { metas: movies };
  } catch (error) {
    console.error('Error in catalog handler:', error);
    return { metas: [] };
  }
});

// Meta handler (optional but provides better detail view)
builder.defineMetaHandler(async ({ type, id }) => {
  console.log(`Meta request: type=${type}, id=${id}`);

  if (type !== 'movie' || !id.startsWith('tt')) {
    return { meta: null };
  }

  // For IMDB IDs, return basic info
  // Stremio will use the catalog data for display
  return {
    meta: {
      id: id,
      type: 'movie',
      name: 'Movie',
      description: 'See catalog for details'
    }
  };
});

const PORT = process.env.PORT || 7000;

module.exports = builder.getInterface();

// Start the addon server
if (require.main === module) {
  const addonInterface = builder.getInterface();
  const { serveHTTP } = require('stremio-addon-sdk');

  serveHTTP(addonInterface, {
    port: PORT,
    cacheMaxAge: 3600 // Cache responses for 1 hour (in seconds)
  }).then(() => {
    console.log(`FilmTV.it addon running on http://localhost:${PORT}`);
    console.log(`Manifest available at: http://localhost:${PORT}/manifest.json`);
  }).catch(err => {
    console.error('Failed to start addon:', err);
    process.exit(1);
  });
}
