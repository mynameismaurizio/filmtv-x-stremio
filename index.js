const { addonBuilder } = require('stremio-addon-sdk');
const { getBestOfYear, getFilteredList, getAllLists, setTMDBApiKey } = require('./scraper');

// Available predefined catalogs
const PREDEFINED_CATALOGS = [
  { year: 2025, id: 'filmtv-best-2025', name: 'FilmTV.it - Migliori del 2025' },
  { year: 2024, id: 'filmtv-best-2024', name: 'FilmTV.it - Migliori del 2024' },
  { year: 2023, id: 'filmtv-best-2023', name: 'FilmTV.it - Migliori del 2023' },
  { year: 2022, id: 'filmtv-best-2022', name: 'FilmTV.it - Migliori del 2022' },
  { year: 2021, id: 'filmtv-best-2021', name: 'FilmTV.it - Migliori del 2021' },
  { year: 2020, id: 'filmtv-best-2020', name: 'FilmTV.it - Migliori del 2020' }
];

// Function to build manifest with user configuration
function buildManifest(config = {}) {
  const catalogs = [];

  // Parse selected predefined catalogs (default: all enabled)
  const selectedYears = config.predefined_catalogs
    ? config.predefined_catalogs.split(',').map(y => parseInt(y.trim()))
    : [2025, 2024, 2023, 2022, 2021, 2020]; // Default: all enabled

  // Genre and country options for filters
  const GENRES = ['Azione', 'Commedia', 'Drammatico', 'Horror', 'Fantascienza', 'Thriller',
                  'Animazione', 'Avventura', 'Fantasy', 'Guerra', 'Documentario', 'Romantico',
                  'Biografico', 'Storico', 'Musicale', 'Western', 'Noir', 'Giallo'];

  const COUNTRIES = ['Italia', 'USA', 'Francia', 'Gran Bretagna', 'Germania', 'Spagna',
                     'Giappone', 'Corea del Sud', 'Canada', 'Australia', 'Cina', 'India'];

  // Add selected predefined catalogs
  PREDEFINED_CATALOGS.forEach(catalog => {
    if (selectedYears.includes(catalog.year)) {
      catalogs.push({
        type: 'movie',
        id: catalog.id,
        name: catalog.name,
        extra: [
          { name: 'skip', isRequired: false },
          { name: 'genre', isRequired: false, options: GENRES },
          { name: 'country', isRequired: false, options: COUNTRIES }
        ]
      });
    }
  });

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
    logo: 'https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/DraftAi-2.png',
    background: 'https://raw.githubusercontent.com/mynameismaurizio/filmtv-x-stremio/refs/heads/main/locandinesthether.png',
    resources: ['catalog', 'meta'],
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
        key: 'predefined_catalogs',
        type: 'text',
        title: '📚 Cataloghi Predefiniti (Selezionati)',
        required: false,
        default: '2025,2024,2023,2022,2021,2020',
        options: [
          '✅ TUTTI I CATALOGHI SONO GIÀ SELEZIONATI',
          '',
          'Per DISABILITARE un catalogo, rimuovi il suo anno dalla lista.',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '🎬 Cataloghi disponibili:',
          '  ☑️  2025 - Migliori del 2025',
          '  ☑️  2024 - Migliori del 2024',
          '  ☑️  2023 - Migliori del 2023',
          '  ☑️  2022 - Migliori del 2022',
          '  ☑️  2021 - Migliori del 2021',
          '  ☑️  2020 - Migliori del 2020',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          '💡 Esempi:',
          '  • Tutti: 2025,2024,2023,2022,2021,2020',
          '  • Solo ultimi 3 anni: 2025,2024,2023',
          '  • Solo 2024 e 2022: 2024,2022',
          '  • Nessuno: (lascia vuoto)'
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
    console.log(`✓ Using TMDB API key from config for catalog ${id}`);
    setTMDBApiKey(config.tmdb_api_key);
  } else if (process.env.TMDB_API_KEY) {
    console.log(`✓ Using TMDB API key from environment for catalog ${id}`);
    setTMDBApiKey(process.env.TMDB_API_KEY);
  } else {
    // If no config and no env var, return error
    console.error(`✗ No TMDB API key found for catalog ${id}`);
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

    // Check if genre or country filters are applied
    const hasFilters = (extra && extra.genre) || (extra && extra.country);

    if (hasFilters) {
      // Build filter string for getFilteredList
      // FilmTV format: /migliori/genre/country/anno-YEAR/#
      const filters = [];

      if (extra.genre) {
        // Convert Italian genre name to FilmTV filter format (lowercase, no prefix)
        const genreMap = {
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
          'Giallo': 'giallo'
        };
        const genreFilter = genreMap[extra.genre] || extra.genre.toLowerCase();
        filters.push(genreFilter);
      }

      if (extra.country) {
        // Convert country name to FilmTV filter format (lowercase, no prefix)
        const countryMap = {
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
        const countryFilter = countryMap[extra.country] || extra.country.toLowerCase().replace(/ /g, '-');
        filters.push(countryFilter);
      }

      // Year always comes last with "anno-" prefix
      filters.push(`anno-${year}`);

      const filterString = filters.join('/');
      console.log(`✓ Fetching filtered catalog for ${year} with filters: ${filterString}`);
      const movies = await getFilteredList(filterString);
      console.log(`✓ Returning ${movies.length} filtered movies for catalog ${id}`);
      return { metas: movies };
    } else {
      // No filters - return all movies for the year
      const movies = await getBestOfYear(year);
      console.log(`✓ Returning ${movies.length} movies for catalog ${id}`);
      return { metas: movies };
    }
  } catch (error) {
    console.error(`✗ Error in catalog handler for ${id}:`, error.message);
    console.error('Stack trace:', error.stack);
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
  const { serveHTTP } = require('stremio-addon-sdk');

  serveHTTP(builder.getInterface(), { port: PORT });

  console.log(`FilmTV.it addon running on http://localhost:${PORT}`);
  console.log(`Manifest available at: http://localhost:${PORT}/manifest.json`);
  console.log(`Configuration page: https://cacaspruz-filmtv-x-stremio.hf.space/configure.html`);
}
