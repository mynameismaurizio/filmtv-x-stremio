const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getAllLists, setTMDBApiKey } = require('./scraper');

// Define the addon manifest
const manifest = {
  id: 'community.filmtv.it',
  version: '1.1.0',
  name: 'FilmTV.it - I Migliori Film',
  description: 'Sfoglia le liste curate di FilmTV.it con i migliori film per anno',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  catalogs: [
    {
      type: 'movie',
      id: 'filmtv-best-2025',
      name: 'FilmTV.it - Migliori del 2025',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'movie',
      id: 'filmtv-best-2024',
      name: 'FilmTV.it - Migliori del 2024',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'movie',
      id: 'filmtv-best-2023',
      name: 'FilmTV.it - Migliori del 2023',
      extra: [{ name: 'skip', isRequired: false }]
    }
  ],
  idPrefixes: ['filmtv_'],
  // User configuration
  config: [
    {
      key: 'tmdb_api_key',
      type: 'text',
      title: 'Chiave API TMDB',
      required: true,
      default: ''
    }
  ],
  behaviorHints: {
    configurable: true,
    configurationRequired: true
  }
};

const builder = new addonBuilder(manifest);

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  if (type !== 'movie') {
    return { metas: [] };
  }

  // Set the TMDB API key from user configuration
  if (config && config.tmdb_api_key) {
    setTMDBApiKey(config.tmdb_api_key);
  } else if (!process.env.TMDB_API_KEY) {
    // If no config and no env var, return error
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
    // Silently return cached results (logging happens in scraper.js only for fresh fetches)
    return { metas: movies };
  } catch (error) {
    console.error('Error in catalog handler:', error);
    return { metas: [] };
  }
});

// Meta handler (optional but provides better detail view)
builder.defineMetaHandler(async ({ type, id }) => {
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
