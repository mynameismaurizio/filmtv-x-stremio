const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getFilteredList, getAllLists, setTMDBApiKey } = require('./scraper');

// Function to build manifest with user configuration
function buildManifest(config = {}) {
  const catalogs = [
    // Default popular catalogs
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
    },
    {
      type: 'movie',
      id: 'filmtv-best-2022',
      name: 'FilmTV.it - Migliori del 2022',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'movie',
      id: 'filmtv-best-2021',
      name: 'FilmTV.it - Migliori del 2021',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'movie',
      id: 'filmtv-best-2020',
      name: 'FilmTV.it - Migliori del 2020',
      extra: [{ name: 'skip', isRequired: false }]
    }
  ];

  // Add custom catalogs based on user configuration
  if (config.custom_catalogs) {
    const customCatalogs = parseCustomCatalogs(config.custom_catalogs);
    catalogs.push(...customCatalogs);
  }

  return {
    id: 'community.filmtv.it',
    version: '1.2.0',
    name: 'FilmTV.it - I Migliori Film',
    description: 'Sfoglia le liste curate di FilmTV.it con i migliori film per anno e filtri personalizzati',
    resources: ['catalog', 'meta'],
    types: ['movie'],
    catalogs: catalogs,
    idPrefixes: ['filmtv_'],
    // User configuration
    config: [
      {
        key: 'tmdb_api_key',
        type: 'text',
        title: 'Chiave API TMDB',
        required: true,
        default: ''
      },
      {
        key: 'custom_catalogs',
        type: 'text',
        title: 'Cataloghi Personalizzati (opzionale)',
        required: false,
        default: '',
        options: [
          'Esempi:',
          'Azione 2019|anno-2019|genere-azione',
          'Horror Italiani|genere-horror|paese-italia',
          '',
          'Formato: Nome|filtro1|filtro2;',
          'Separa più cataloghi con ";"',
          '',
          'Filtri disponibili:',
          'Anno: anno-2024, anno-2023, anni-2010',
          'Genere: genere-azione, genere-commedia, genere-horror',
          'Paese: paese-usa, paese-italia, paese-francia',
          '',
          'Guida completa: CATALOGHI_PERSONALIZZATI.md'
        ].join('\n')
      }
    ],
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };
}

// Parse custom catalog configuration
function parseCustomCatalogs(customConfig) {
  if (!customConfig || !customConfig.trim()) return [];

  const catalogs = [];
  const lines = customConfig.split(';').map(l => l.trim()).filter(l => l);

  for (const line of lines) {
    try {
      // Format: "Nome|anno-2019" or "Nome|genere-azione|anno-2020"
      const parts = line.split('|');
      if (parts.length < 2) continue;

      const name = parts[0].trim();
      const filters = parts.slice(1).join('/');
      const id = `filmtv-custom-${filters.replace(/\//g, '-')}`;

      catalogs.push({
        type: 'movie',
        id: id,
        name: `FilmTV.it - ${name}`,
        extra: [{ name: 'skip', isRequired: false }]
      });
    } catch (e) {
      console.error('Error parsing custom catalog:', line, e);
    }
  }

  return catalogs;
}

const builder = new addonBuilder(buildManifest());

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

  try {
    // Handle custom catalogs
    if (id.startsWith('filmtv-custom-')) {
      const filters = id.replace('filmtv-custom-', '').split('-').join('/');
      const movies = await getFilteredList(filters);
      return { metas: movies };
    }

    // Handle default year catalogs
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
      case 'filmtv-best-2022':
        year = 2022;
        break;
      case 'filmtv-best-2021':
        year = 2021;
        break;
      case 'filmtv-best-2020':
        year = 2020;
        break;
      default:
        return { metas: [] };
    }

    const movies = await getBestOfYear(year);
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
