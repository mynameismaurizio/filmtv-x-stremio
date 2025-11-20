---
title: Filmtvpestremio
emoji: 📉
colorFrom: gray
colorTo: green
sdk: docker
pinned: false
short_description: Un addon per consultare i cataloghi di FilmTV su Stremio
---

# FilmTV.X Stremio Addon

A Stremio addon that provides curated movie catalogs using TMDB (The Movie Database) API.

## Features

- 📽️ Browse best movies by year (2023, 2024, 2025)
- 🎬 High-quality posters and metadata from TMDB
- 🇮🇹 Italian language support
- ⭐ Movie ratings and descriptions
- 🎯 Proper IMDB ID integration for seamless Stremio experience

## Installation in Stremio

Install the addon using this URL:
```
https://cacaspruz-filmtv-x-stremio.hf.space/manifest.json
```

## For Developers

### Prerequisites

- Node.js 20+
- TMDB API key (free from https://www.themoviedb.org/settings/api)

### Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your TMDB API key:
   ```bash
   export TMDB_API_KEY=your_api_key_here
   ```
4. Run the addon:
   ```bash
   npm start
   ```
5. The addon will be available at `http://localhost:7000/manifest.json`

## Deployment to Hugging Face Spaces

1. Create a new Space with Docker SDK
2. Add your TMDB API key as a secret in Space settings:
   - Go to your Space Settings
   - Under "Variables and secrets" → "Secrets"
   - Add: `TMDB_API_KEY` with your API key value
3. Update the Dockerfile to use the latest code from GitHub
4. The Space will automatically rebuild and deploy

### Environment Variables

- `TMDB_API_KEY` - Your TMDB API key (required)
- `PORT` - Server port (default: 7860 for HF Spaces, 7000 for local)

## Technical Details

- Built with [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk)
- Uses TMDB API for movie data
- Caches API responses for 1 hour
- Returns proper IMDB IDs for Stremio compatibility

## License

MIT
