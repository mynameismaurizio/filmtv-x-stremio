const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getFilteredList, getAllLists, setTMDBApiKey, getMovieByImdbId, getMovieByImdbIdFromTMDB, prewarmPopularCatalogs, startCacheRefresh, getResponseTimeStats } = require('./scraper-safe');

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

// Available predefined catalogs (years and decades)
const PREDEFINED_CATALOGS = [
  // Recent years
  { filter: 'anno-2025', id: 'filmtv-2025', name: 'FilmTV.it - Migliori del 2025' },
  { filter: 'anno-2024', id: 'filmtv-2024', name: 'FilmTV.it - Migliori del 2024' },
  { filter: 'anno-2023', id: 'filmtv-2023', name: 'FilmTV.it - Migliori del 2023' },
  { filter: 'anno-2022', id: 'filmtv-2022', name: 'FilmTV.it - Migliori del 2022' },
  { filter: 'anno-2021', id: 'filmtv-2021', name: 'FilmTV.it - Migliori del 2021' },
  { filter: 'anno-2020', id: 'filmtv-2020', name: 'FilmTV.it - Migliori del 2020' },
  // Decades
  { filter: 'anni-2020', id: 'filmtv-2020s', name: 'FilmTV.it - Migliori anni 2020-2029' },
  { filter: 'anni-2010', id: 'filmtv-2010s', name: 'FilmTV.it - Migliori anni 2010-2019' },
  { filter: 'anni-2000', id: 'filmtv-2000s', name: 'FilmTV.it - Migliori anni 2000-2009' },
  { filter: 'anni-1990', id: 'filmtv-1990s', name: 'FilmTV.it - Migliori anni 1990-1999' },
  { filter: 'anni-1980', id: 'filmtv-1980s', name: 'FilmTV.it - Migliori anni 1980-1989' }
];

// Genre and country options combined in one dropdown
const GENRES = ['Azione', 'Commedia', 'Drammatico', 'Horror', 'Fantascienza', 'Thriller',
                'Animazione', 'Avventura', 'Fantasy', 'Guerra', 'Documentario', 'Romantico',
                'Biografico', 'Storico', 'Musicale', 'Western', 'Noir', 'Giallo'];

// Countries for dropdown (most common ones to keep manifest size under 8KB)
// All other countries are still available via custom catalogs using filterMap
const COUNTRIES = [
  'Italia', 'USA', 'Francia', 'Gran Bretagna', 'Germania', 'Spagna',
  'Giappone', 'Corea del Sud', 'Canada', 'Australia', 'Cina', 'India',
  'Brasile', 'Messico', 'Russia', 'Argentina', 'Belgio', 'Svezia',
  'Norvegia', 'Danimarca', 'Olanda', 'Polonia', 'Grecia', 'Turchia',
  'Iran', 'Israele'
];

// Combine genres and countries into single filter list
const FILTER_OPTIONS = [...GENRES, ...COUNTRIES];

// Build static manifest with all available catalogs
function buildManifest() {
  const catalogs = [];

  // Add all predefined catalogs (years and decades)
  PREDEFINED_CATALOGS.forEach(catalog => {
    catalogs.push({
      type: 'movie',
      id: catalog.id,
      name: catalog.name,
      extra: [
        { name: 'skip', isRequired: false },
        { name: 'genre', isRequired: false, options: FILTER_OPTIONS }
      ]
    });
  });

  return {
    id: 'community.filmtv.it',
    version: '1.3.1',
    name: 'FilmTV.it - I Migliori Film',
    description: 'Sfoglia le liste curate di FilmTV.it con i migliori film per anno e filtri personalizzati',
    logo: 'https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/DraftAi-2.png',
    background: 'https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/locandinesthether.png',
    resources: ['catalog', 'meta'],
    types: ['movie'],
    catalogs: catalogs,
    // Catalog returns IMDB IDs (tt...); expose that prefix so meta handler is invoked
    idPrefixes: ['tt'],
    // User configuration
    config: [
      {
        key: 'tmdb_api_key',
        type: 'text',
        title: '🔑 Chiave API TMDB (OBBLIGATORIA)',
        required: true,
        default: '',
        options: [
          'OBBLIGATORIA! Ottieni la chiave su themoviedb.org',
          'Impostazioni → API → Richiedi chiave API',
          'Copia la chiave da "API Key (v3 auth)"'
        ].join('\n')
      },
      {
        key: 'custom_catalogs',
        type: 'text',
        title: '✨ Cataloghi Personalizzati',
        required: false,
        default: '',
        options: [
          'Formato: Nome|filtro1|filtro2',
          'Es: Film Azione 2024|anno-2024|genere-azione',
          'Filtri: anno-2024, genere-azione, paese-italia'
        ].join('\n')
      }
    ],
    behaviorHints: {
      configurable: true,
      configurationRequired: true
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
      // Use base64 encoding to preserve filter structure (handles hyphens in filter names)
      const filtersEncoded = Buffer.from(filters).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const id = `filmtv-custom-${filtersEncoded}`;

      catalogs.push({
        type: 'movie',
        id: id,
        name: `FilmTV.it - ${name}`,
        extra: [{ name: 'skip', isRequired: false }]
      });
    } catch (e) {
      logError('Error parsing custom catalog:', line, e);
    }
  }

  return catalogs;
}

// Create builder with default manifest
const builder = new addonBuilder(buildManifest());

// Extract catalog handler logic to a separate function so we can call it from Express too
async function handleCatalogRequest({ type, id, extra, config }) {
  const catalogStart = Date.now();
  
  if (type !== 'movie') {
    return { metas: [] };
  }

  // Set the TMDB API key from user configuration
  if (config && config.tmdb_api_key) {
    log(`✓ Using TMDB API key from config for catalog ${id}`);
    setTMDBApiKey(config.tmdb_api_key);
  } else if (process.env.TMDB_API_KEY) {
    log(`✓ Using TMDB API key from environment for catalog ${id}`);
    setTMDBApiKey(process.env.TMDB_API_KEY);
  } else {
    // If no config and no env var, return error
    logError(`✗ No TMDB API key found for catalog ${id}`);
    return { metas: [] };
  }

  try {
    // Handle custom catalogs
    if (id.startsWith('filmtv-custom-')) {
      const filtersEncoded = id.replace('filmtv-custom-', '');
      // Decode base64 filters (reverse the encoding from parseCustomCatalogs)
      const filtersBase64 = filtersEncoded.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padding = '='.repeat((4 - filtersBase64.length % 4) % 4);
      const filters = Buffer.from(filtersBase64 + padding, 'base64').toString('utf-8');
      const movies = await getFilteredList(filters);
      return { metas: movies };
    }

    // Handle predefined and user-defined year/decade catalogs
    // Extract year filter from catalog ID
    let yearFilter = null;

    // Check predefined catalogs
    const predefinedCatalog = PREDEFINED_CATALOGS.find(c => c.id === id);
    if (predefinedCatalog) {
      yearFilter = predefinedCatalog.filter;
    } else if (id.startsWith('filmtv-user-')) {
      // User-defined catalog: filmtv-user-anno-2019 or filmtv-user-anni-1990
      yearFilter = id.replace('filmtv-user-', '');
    }

    if (!yearFilter) {
      logError(`✗ Unknown catalog ID: ${id}`);
      return { metas: [] };
    }

    // Combined genre and country mapping
    const filterMap = {
      // Genres
      'Azione': 'azione',
      'Commedia': 'commedia',
      'Drammatico': 'drammatico',
      'Horror': 'horror',
      'Fantascienza': 'fantascienza',
      'Thriller': 'thriller',
      'Animazione': 'animazione',
      'Avventura': 'avventura',
      'Fantasy': 'fantasy',
      'Guerra': 'guerra',
      'Documentario': 'documentario',
      'Romantico': 'sentimentale',
      'Biografico': 'biografico',
      'Storico': 'storico',
      'Musicale': 'musicale',
      'Western': 'western',
      'Noir': 'noir',
      'Giallo': 'giallo',
      // Countries
      'Italia': 'italia',
      'USA': 'usa',
      'Francia': 'francia',
      'Gran Bretagna': 'gran-bretagna',
      'Germania': 'germania',
      'Spagna': 'spagna',
      'Giappone': 'giappone',
      'Corea del Sud': 'corea-del-sud',
      'Corea del Nord': 'corea-del-nord',
      'Canada': 'canada',
      'Australia': 'australia',
      'Cina': 'cina',
      'India': 'india',
      'Argentina': 'argentina',
      'Austria': 'austria',
      'Belgio': 'belgio',
      'Brasile': 'brasile',
      'Bulgaria': 'bulgaria',
      'Burkina Faso': 'burkina-faso',
      'Cecoslovacchia': 'cecoslovacchia',
      'Cile': 'cile',
      'Colombia': 'colombia',
      'Croazia': 'croazia',
      'Cuba': 'cuba',
      'Danimarca': 'danimarca',
      'Egitto': 'egitto',
      'Finlandia': 'finlandia',
      'Georgia': 'georgia',
      'Grecia': 'grecia',
      'Hong Kong': 'hong-kong',
      'Iran': 'iran',
      'Irlanda': 'irlanda',
      'Islanda': 'islanda',
      'Israele': 'israele',
      'Jugoslavia': 'jugoslavia',
      'Lituania': 'lituania',
      'Lussemburgo': 'lussemburgo',
      'Messico': 'messico',
      'Norvegia': 'norvegia',
      'Nuova Zelanda': 'nuova-zelanda',
      'Olanda': 'olanda',
      'Panama': 'panama',
      'Polonia': 'polonia',
      'Portogallo': 'portogallo',
      'Repubblica Ceca': 'repubblica-ceca',
      'Romania': 'romania',
      'Russia': 'russia',
      'Senegal': 'senegal',
      'Sudafrica': 'sudafrica',
      'Svezia': 'svezia',
      'Svizzera': 'svizzera',
      'Taiwan': 'taiwan',
      'Thailandia': 'thailandia',
      'Tunisia': 'tunisia',
      'Turchia': 'turchia',
      'Ungheria': 'ungheria',
      'URSS': 'urss',
      'Vietnam': 'vietnam'
    };

    // Check if genre/country filter is applied
    if (extra && extra.genre) {
      // Build filter string for getFilteredList
      // FilmTV format: /migliori/{genre}/{country}/{year}/#
      const genreFilter = filterMap[extra.genre] || extra.genre.toLowerCase().replace(/ /g, '-');
      const filterString = `${genreFilter}/${yearFilter}`;

      log(`✓ Fetching filtered catalog with filter: ${extra.genre} + ${yearFilter} -> ${filterString}`);
      const movies = await getFilteredList(filterString);
      log(`✓ Returning ${movies.length} filtered movies for catalog ${id}`);
      return { metas: movies };
    } else {
      // No genre/country filter - return all movies for the year/decade
      log(`✓ Fetching catalog for: ${yearFilter}`);
      const movies = await getFilteredList(yearFilter);
      const catalogDuration = Date.now() - catalogStart;
      log(`✓ Returning ${movies.length} movies for catalog ${id} in ${catalogDuration}ms`);
      
      // Track slow catalog responses
      if (catalogDuration > 5000) {
        log(`⚠️ Slow catalog response: ${id} took ${catalogDuration}ms`);
      }
      
      return { metas: movies };
    }
  } catch (error) {
    const catalogDuration = Date.now() - catalogStart;
    logError(`✗ Error in catalog handler for ${id} (${catalogDuration}ms):`, error.message);
    logError('Stack trace:', error.stack);
    return { metas: [] };
  }
}

// Register the handler with builder
builder.defineCatalogHandler(handleCatalogRequest);

// Extract meta handler logic to a separate function
async function handleMetaRequest({ type, id, config }) {
  const metaStart = Date.now();
  
  if (type !== 'movie') {
    return { meta: null };
  }

  // Set the TMDB API key from user configuration
  if (config && config.tmdb_api_key) {
    log(`✓ Using TMDB API key from config for meta ${id}`);
    setTMDBApiKey(config.tmdb_api_key);
  } else if (process.env.TMDB_API_KEY) {
    log(`✓ Using TMDB API key from environment for meta ${id}`);
    setTMDBApiKey(process.env.TMDB_API_KEY);
  }

  try {
    // Extract IMDB ID from Stremio ID format (tt1234567 or filmtv_tt1234567)
    let imdbId = id;
    if (id.startsWith('filmtv_')) {
      imdbId = id.replace('filmtv_', '');
    } else if (!id.startsWith('tt')) {
      // Unknown format, cannot serve meta
      return { meta: null };
    }

    // Search for the movie in cached catalogs
    const movie = getMovieByImdbId(imdbId);
    
    if (movie) {
      const metaDuration = Date.now() - metaStart;
      log(`✓ Returning metadata for ${imdbId} (${movie.name || 'unknown'}) in ${metaDuration}ms`);
      return { meta: movie };
    }

    // Fallback: fetch directly from TMDB by IMDB ID (Italian)
    const tmdbMovie = await getMovieByImdbIdFromTMDB(imdbId);
    if (tmdbMovie) {
      const metaDuration = Date.now() - metaStart;
      log(`✓ Returning TMDB fallback metadata for ${imdbId} (${tmdbMovie.name || 'unknown'}) in ${metaDuration}ms`);
      return { meta: tmdbMovie };
    }

    const metaDuration = Date.now() - metaStart;
    log(`✗ Movie ${imdbId} not found (cache or TMDB fallback) in ${metaDuration}ms`);
    return { meta: null };
  } catch (error) {
    const metaDuration = Date.now() - metaStart;
    logError(`✗ Error in meta handler for ${id} (${metaDuration}ms):`, error.message);
    return { meta: null };
  }
}

// Register the handler with builder
builder.defineMetaHandler(handleMetaRequest);

const PORT = process.env.PORT || 7860;

module.exports = builder.getInterface();

// Start the addon server
if (require.main === module) {
  const express = require('express');
  const http = require('http');
  const { URL } = require('url');

  const app = express();
  app.use(express.json());

  // Health check endpoints (must be first)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'filmtv-x-stremio',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/ping', (req, res) => {
    res.json({ status: 'pong' });
  });

  app.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'filmtv-x-stremio',
      endpoints: {
        manifest: '/manifest.json',
        health: '/health',
        ping: '/ping'
      }
    });
  });

  // Handle manifest.json
  app.get('/manifest.json', (req, res) => {
    const manifest = buildManifest();
    res.json(manifest);
  });

  // Handle catalog requests using our extracted handler function
  app.get('/catalog/:type/:id.json', async (req, res) => {
    try {
      const { type, id } = req.params;
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const extra = query.get('extra') ? JSON.parse(decodeURIComponent(query.get('extra'))) : undefined;
      const config = query.get('config') ? JSON.parse(decodeURIComponent(query.get('config'))) : undefined;
      
      const result = await handleCatalogRequest({ type, id, extra, config });
      res.json(result);
    } catch (error) {
      logError('Error in catalog handler:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Handle meta requests using our extracted handler function
  app.get('/meta/:type/:id.json', async (req, res) => {
    try {
      const { type, id } = req.params;
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const config = query.get('config') ? JSON.parse(decodeURIComponent(query.get('config'))) : undefined;
      
      const result = await handleMetaRequest({ type, id, config });
      res.json(result);
    } catch (error) {
      logError('Error in meta handler:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Start server
  server.listen(PORT, '0.0.0.0', () => {
    log(`FilmTV.it addon running on http://0.0.0.0:${PORT}`);
    log(`Manifest available at: http://0.0.0.0:${PORT}/manifest.json`);
    log(`Health check available at: http://0.0.0.0:${PORT}/health`);
    log(`Addon ready! Configure TMDB API key in Stremio when installing.`);
  });
  
  // Keep-alive ping to prevent sleep
  setInterval(() => {
    http.get(`http://localhost:${PORT}/health`, (res) => {
      // Just ping to keep server alive
    }).on('error', () => {
      // Ignore errors
    });
  }, 4 * 60 * 1000); // Every 4 minutes
  
  // Pre-warm popular catalogs if TMDB API key is available
  if (process.env.TMDB_API_KEY) {
    setTMDBApiKey(process.env.TMDB_API_KEY);
    // Pre-warm in background (don't block server startup)
    setTimeout(() => {
      prewarmPopularCatalogs().then(() => {
        // Start background cache refresh after pre-warming
        startCacheRefresh();
      }).catch(err => {
        logError('Error during pre-warming:', err.message);
      });
    }, 2000); // Wait 2 seconds after startup
  } else {
    log('⚠️ No TMDB_API_KEY in environment - skipping pre-warming');
    log('💡 Pre-warming will happen when users configure their API key');
  }
  
  // Log performance stats periodically
  setInterval(() => {
    const catalogStats = getResponseTimeStats('catalog', 5);
    const tmdbStats = getResponseTimeStats('tmdb', 5);
    
    if (catalogStats) {
      log(`📊 Performance (last 5min): Catalog avg=${Math.round(catalogStats.avg)}ms, p95=${Math.round(catalogStats.p95)}ms, max=${Math.round(catalogStats.max)}ms`);
    }
    if (tmdbStats) {
      log(`📊 Performance (last 5min): TMDB avg=${Math.round(tmdbStats.avg)}ms, p95=${Math.round(tmdbStats.p95)}ms`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    log('📴 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
      log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('📴 Received SIGINT, shutting down gracefully...');
    server.close(() => {
      log('✅ Server closed');
      process.exit(0);
    });
  });
}
