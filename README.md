# Stremio FilmTV.it Addon

A Stremio addon that provides curated movie lists from [FilmTV.it](https://www.filmtv.it), including "Best of Year" collections.

## Features

- Browse best movies by year (2023, 2024, 2025)
- Movie metadata including ratings, genres, directors, and cast
- Automatic caching to reduce server load
- Easy deployment to Hugging Face Spaces

## Installation

### Local Development

1. Clone the repository using **GitHub Desktop**:
   - Open GitHub Desktop
   - Click **File** → **Clone Repository**
   - Click the **URL** tab
   - Enter: `https://github.com/YOUR_USERNAME/filmtv-x-stremio.git`
   - Choose where to save it on your computer
   - Click **Clone**

2. Install dependencies:
```bash
npm install
```

3. Start the addon:
```bash
npm start
```

4. The addon will be available at `http://localhost:7000`

5. Add to Stremio by visiting: `http://localhost:7000/manifest.json`

### Deployment to Hugging Face

This addon is designed to run on Hugging Face Spaces. The live version is available at:
`https://YOUR_USERNAME-filmtv-x-stremio.hf.space`

## Usage

After installing the addon in Stremio:

1. Open Stremio
2. Go to the Board
3. Look for "FilmTV.it - Best of [Year]" catalogs
4. Browse curated movie lists from FilmTV.it

## Technical Details

- Built with [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk)
- Web scraping with Axios and Cheerio
- Includes 1-hour caching mechanism
- Provides catalog resources for movie discovery

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License
