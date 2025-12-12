const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getFilteredList, getAllLists, setTMDBApiKey } = require('./scraper-safe');

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
    resources: ['catalog'],
    types: ['movie'],
    catalogs: catalogs,
    idPrefixes: ['filmtv_'],
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
  // #region agent log
  console.log('[DEBUG] Catalog handler entry:', { type, id, extra, hasConfig: !!config, configKeys: config ? Object.keys(config) : [] });
  fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:199',message:'Catalog handler entry',data:{type,id,extra:JSON.stringify(extra),hasConfig:!!config,configKeys:config?Object.keys(config):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  if (type !== 'movie') {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:202',message:'Non-movie type, returning empty',data:{type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return { metas: [] };
  }

  // Set the TMDB API key from user configuration
  // #region agent log
  console.log('[DEBUG] Config check:', { hasConfig: !!config, configType: typeof config, configKeys: config ? Object.keys(config) : [], hasEnvKey: !!process.env.TMDB_API_KEY });
  // #endregion
  
  if (config && config.tmdb_api_key) {
    log(`✓ Using TMDB API key from config for catalog ${id}`);
    setTMDBApiKey(config.tmdb_api_key);
    // #region agent log
    console.log('[DEBUG] Using TMDB key from config, length:', config.tmdb_api_key.length);
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:207',message:'Using TMDB key from config',data:{catalogId:id,keyLength:config.tmdb_api_key.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } else if (process.env.TMDB_API_KEY) {
    log(`✓ Using TMDB API key from environment for catalog ${id}`);
    setTMDBApiKey(process.env.TMDB_API_KEY);
    // #region agent log
    console.log('[DEBUG] Using TMDB key from env');
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:210',message:'Using TMDB key from env',data:{catalogId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } else {
    // Use test key as fallback (for local testing and when config is not passed)
    // In production, users should set TMDB_API_KEY environment variable or configure via Stremio
    const TEST_TMDB_KEY = '8d2aab34f6381b9a1e02f68fc17cfd81';
    log(`⚠ Using fallback TMDB API key for catalog ${id} (config was empty - using test key)`);
    setTMDBApiKey(TEST_TMDB_KEY);
    // #region agent log
    console.warn('[DEBUG] Using fallback TMDB key!', { catalogId: id, hasConfig: !!config, config, configType: typeof config, configKeys: config ? Object.keys(config) : [] });
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:214',message:'Using fallback TMDB key',data:{catalogId:id,hasConfig:!!config,configKeys:config?Object.keys(config):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  }

  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:217',message:'Starting catalog processing',data:{catalogId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Handle custom catalogs
    if (id.startsWith('filmtv-custom-')) {
      const filtersEncoded = id.replace('filmtv-custom-', '');
      // Decode base64 filters (reverse the encoding from parseCustomCatalogs)
      const filtersBase64 = filtersEncoded.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padding = '='.repeat((4 - filtersBase64.length % 4) % 4);
      const filters = Buffer.from(filtersBase64 + padding, 'base64').toString('utf-8');
      const movies = await getFilteredList(filters);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:227',message:'Custom catalog result',data:{catalogId:id,moviesCount:movies.length,firstMovie:movies[0]?Object.keys(movies[0]):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      console.log('[DEBUG] About to call getFilteredList with:', yearFilter);
      // #endregion
      const movies = await getFilteredList(yearFilter);
      log(`✓ Returning ${movies.length} movies for catalog ${id}`);
      // #region agent log
      console.log('[DEBUG] Year catalog result:', { catalogId: id, yearFilter, moviesCount: movies.length, firstMovie: movies[0] ? Object.keys(movies[0]) : [], firstMovieSample: movies[0] });
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:300',message:'Year catalog result',data:{catalogId:id,yearFilter,moviesCount:movies.length,firstMovie:movies[0]?Object.keys(movies[0]):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return { metas: movies };
    }
  } catch (error) {
    logError(`✗ Error in catalog handler for ${id}:`, error.message);
    logError('Stack trace:', error.stack);
    // #region agent log
    console.error('[DEBUG] Catalog handler error:', { catalogId: id, errorMessage: error.message, errorStack: error.stack });
    fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:302',message:'Catalog handler error',data:{catalogId:id,errorMessage:error.message,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return { metas: [] };
  }
});

// Meta handler removed - Stremio will use catalog descriptions
// This ensures the FilmTV ratings and descriptions persist when viewing movie details

const PORT = process.env.PORT || 7860;

module.exports = builder.getInterface();

// Start the addon server
if (require.main === module) {
  const express = require('express');
  const { getRouter } = require('stremio-addon-sdk');
  const fs = require('fs');
  const path = require('path');

  const app = express();

  // Parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve HTML page for root with all SEO meta tags
  app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) {
        // Fallback HTML with SEO if file doesn't exist
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FilmTV.it - Stremio Addon | I Migliori Film Curati</title>
  <meta name="description" content="Sfoglia le liste curate di FilmTV.it con i migliori film per anno, genere e paese. Addon Stremio con integrazione TMDB.">
  <meta property="og:title" content="FilmTV.it - Stremio Addon">
  <meta property="og:description" content="I Migliori Film Curati da FilmTV.it">
  <meta property="og:image" content="https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/locandinesthether.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://filmtv-x-stremio-production.up.railway.app/">
</head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
  <h1>FilmTV.it Stremio Addon</h1>
  <p>✅ Online</p>
  <p><a href="/manifest.json">Manifest</a></p>
</body>
</html>
        `);
      } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(data);
      }
    });
  });

  // Serve configure page (redirects to home with configure tab)
  app.get('/configure', (req, res) => {
    res.redirect('/#configure');
  });

  // Handle configure POST (Stremio SDK format)
  app.post('/configure', (req, res) => {
    try {
      // Stremio SDK expects config in req.body.config
      const config = req.body.config || req.body;
      
      // Validate TMDB API key if provided
      if (config.tmdb_api_key) {
        const apiKey = config.tmdb_api_key.trim();
        if (apiKey.length !== 32 || !/^[a-f0-9]{32}$/i.test(apiKey)) {
          return res.status(400).json({ 
            error: 'La chiave API TMDB deve essere esattamente 32 caratteri esadecimali' 
          });
        }
      }
      
      // Return success - Stremio will store the config
      res.json({ 
        success: true, 
        message: 'Configurazione salvata con successo',
        config: config
      });
    } catch (error) {
      logError('Configure error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add CORS headers for Stremio
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    // Only set Content-Type for JSON responses (not HTML)
    if (!req.path.startsWith('/') || req.path === '/configure') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    
    if (req.path.startsWith('/catalog/') || req.path.startsWith('/manifest')) {
      // #region agent log
      console.log('[DEBUG] Request received:', { method: req.method, path: req.path, query: req.query, queryString: req.url.split('?')[1] || 'none' });
      fetch('http://127.0.0.1:7243/ingest/20a47d38-31c8-4ae5-a382-7068e77f739d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:398',message:'Request received',data:{method:req.method,path:req.path,query:JSON.stringify(req.query),queryString:req.url.split('?')[1]||'none',headers:JSON.stringify(req.headers)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }
    next();
  });

  // Use Stremio addon router for all other routes
  app.use('/', getRouter(builder.getInterface()));

  app.listen(PORT, '0.0.0.0', () => {
    log(`FilmTV.it addon running on http://0.0.0.0:${PORT}`);
    log(`Manifest available at: http://0.0.0.0:${PORT}/manifest.json`);
    log(`Homepage available at: http://0.0.0.0:${PORT}/`);
    log(`Addon ready! Configure TMDB API key in Stremio when installing.`);
  });
}
