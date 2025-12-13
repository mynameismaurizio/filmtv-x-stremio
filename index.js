const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getFilteredList, getAllLists, setTMDBApiKey, getMovieByImdbId } = require('./scraper-safe');

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

const COUNTRIES = ['Italia', 'USA', 'Francia', 'Gran Bretagna', 'Germania', 'Spagna',
                   'Giappone', 'Corea del Sud', 'Canada', 'Australia', 'Cina', 'India'];

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
    version: '1.3.0',
    name: 'FilmTV.it - I Migliori Film',
    description: 'Sfoglia le liste curate di FilmTV.it con i migliori film per anno e filtri personalizzati',
    logo: 'https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/DraftAi-2.png',
    background: 'https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/locandinesthether.png',
    resources: ['catalog', 'meta'],
    types: ['movie'],
    catalogs: catalogs,
    // idPrefixes removed - we want to handle all movie IDs in meta handler
    // User configuration
    config: [
      {
        key: 'tmdb_api_key',
        type: 'text',
        title: '🔑 Chiave API TMDB (OBBLIGATORIA)',
        required: true,
        default: '',
        options: [
          '',
          '⚠️  QUESTA CHIAVE È OBBLIGATORIA!',
          '',
          '📝 Come ottenere la tua chiave TMDB:',
          '1. Vai su https://www.themoviedb.org',
          '2. Crea un account gratuito',
          '3. Vai su Impostazioni → API',
          '4. Richiedi una chiave API',
          '5. Copia la chiave da "API Key (v3 auth)"',
          '',
          '✅ La chiave deve essere 32 caratteri esadecimali',
          '❌ Senza questa chiave, l\'addon NON funzionerà'
        ].join('\n')
      },
      {
        key: 'custom_catalogs',
        type: 'text',
        title: '✨ Cataloghi Personalizzati',
        required: false,
        default: '',
        options: [
          '➕ AGGIUNGI I TUOI CATALOGHI PERSONALIZZATI',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '📝 Formato: Nome Catalogo|filtro-1|filtro-2',
          '   Separa più cataloghi con ";"',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          '🎯 ESEMPI PRONTI (copia e incolla):',
          '',
          '  Film Azione 2024|anno-2024|genere-azione',
          '  Horror Italiani|genere-horror|paese-italia',
          '  Commedie Francesi|genere-commedia|paese-francia',
          '  Fantascienza Anni 2010|genere-fantascienza|anni-2010',
          '  Thriller USA|genere-thriller|paese-usa',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '🔍 FILTRI DISPONIBILI:',
          '',
          '📅 Anno:',
          '  anno-2024, anno-2023, anno-2022, anno-2021, anno-2020',
          '  anno-2019, anno-2018, anni-2010, anni-2000',
          '',
          '🎬 Genere:',
          '  genere-azione, genere-commedia, genere-drammatico',
          '  genere-horror, genere-fantascienza, genere-thriller',
          '  genere-animazione, genere-documentario, genere-romantico',
          '  genere-avventura, genere-fantasy, genere-guerra',
          '',
          '🌍 Paese:',
          '  paese-usa, paese-italia, paese-francia, paese-uk',
          '  paese-giappone, paese-spagna, paese-germania',
          '  paese-corea-del-sud, paese-canada, paese-australia',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '💡 Per creare PIÙ cataloghi:',
          '',
          '  Azione 2024|anno-2024|genere-azione;',
          '  Horror Italia|genere-horror|paese-italia;',
          '  Commedie Francesi|genere-commedia|paese-francia',
          '',
          '  (nota il ";" tra i cataloghi)',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
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

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
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
      'Canada': 'canada',
      'Australia': 'australia',
      'Cina': 'cina',
      'India': 'india'
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
      log(`✓ Returning ${movies.length} movies for catalog ${id}`);
      return { metas: movies };
    }
  } catch (error) {
    logError(`✗ Error in catalog handler for ${id}:`, error.message);
    logError('Stack trace:', error.stack);
    return { metas: [] };
  }
});

// Meta handler - returns the same metadata from catalog (with Italian description)
// This ensures the FilmTV ratings and Italian descriptions persist when viewing movie details
builder.defineMetaHandler(async ({ type, id, config }) => {
  log(`🔍 Meta handler called: type=${type}, id=${id}`);
  
  if (type !== 'movie') {
    log(`✗ Meta handler: type is not 'movie', returning null`);
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
      log(`✓ Extracted IMDB ID from filmtv_ prefix: ${imdbId}`);
    } else if (id.startsWith('tt')) {
      imdbId = id;
      log(`✓ Using IMDB ID directly: ${imdbId}`);
    } else {
      log(`⚠️ Meta handler: ID format not recognized: ${id}`);
      return { meta: null };
    }

    // Search for the movie in cached catalogs
    log(`🔍 Searching for movie ${imdbId} in cached catalogs...`);
    const movie = getMovieByImdbId(imdbId);
    
    if (movie) {
      log(`✓ Returning metadata for ${imdbId} (${movie.name || 'unknown'})`);
      return { meta: movie };
    }

    log(`✗ Movie ${imdbId} not found in cached catalogs`);
    return { meta: null };
  } catch (error) {
    logError(`✗ Error in meta handler for ${id}:`, error.message);
    logError('Stack trace:', error.stack);
    return { meta: null };
  }
});

const PORT = process.env.PORT || 7860;

module.exports = builder.getInterface();

// Start the addon server
if (require.main === module) {
  const { serveHTTP } = require('stremio-addon-sdk');

  // Listen on 0.0.0.0 to be accessible from outside the container
  serveHTTP(builder.getInterface(), { 
    port: PORT,
    host: '0.0.0.0'  // Required for Railway and other cloud services
  });

  log(`FilmTV.it addon running on http://0.0.0.0:${PORT}`);
  log(`Manifest available at: http://0.0.0.0:${PORT}/manifest.json`);
  log(`Addon ready! Configure TMDB API key in Stremio when installing.`);
}
