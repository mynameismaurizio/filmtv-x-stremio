# Deployment Steps for FilmTV.X Addon

## What Changed

The addon has been updated to use the TMDB API instead of web scraping. This provides:
- ✅ Proper IMDB IDs (so movies open correctly in Stremio)
- ✅ High-quality posters
- ✅ Complete metadata (ratings, descriptions, genres, etc.)
- ✅ More reliable data

## Step 1: Push to GitHub

Since you don't have git command line tools, use **GitHub Desktop**:

1. Open **GitHub Desktop**
2. It should show the changed files:
   - `scraper.js` (completely rewritten to use TMDB)
   - `index.js` (updated to work with TMDB data)
   - `package.json` (removed cheerio dependency)
   - `README.md` (updated documentation)
3. Write a commit message: "Switch to TMDB API for better movie data"
4. Click **Commit to main**
5. Click **Push origin** to upload to GitHub

## Step 2: Add TMDB API Key to Hugging Face

1. Go to your Hugging Face Space: https://huggingface.co/spaces/cacaspruz/filmtv-x-stremio/settings
2. Scroll to **"Variables and secrets"** section
3. Under **"Secrets"**, click **"New secret"**
4. Add:
   - Name: `TMDB_API_KEY`
   - Value: `8d2aab34f6381b9a1e02f68fc17cfd81`
5. Click **Save**

## Step 3: Trigger Hugging Face Rebuild

Your Space should automatically rebuild when GitHub updates, but if not:

1. Go to https://huggingface.co/spaces/cacaspruz/filmtv-x-stremio/settings
2. Scroll to **"Restart this Space"**
3. Click **"Restart this Space"**

The build will take about 2-3 minutes.

## Step 4: Test Your Addon

Once the Space is running:

1. Visit: https://cacaspruz-filmtv-x-stremio.hf.space/catalog/movie/filmtv-best-2024.json
2. You should see movies with:
   - IMDB IDs starting with `tt`
   - Posters from TMDB
   - Ratings and descriptions

3. Install in Stremio:
   - Open Stremio
   - Go to **Addons**
   - Paste: `https://cacaspruz-filmtv-x-stremio.hf.space/manifest.json`
   - Click **Install**

4. Test it:
   - Go to the **Board** in Stremio
   - Look for "FilmTV.it - Best of 2024" catalog
   - Click on a movie - it should open properly now!

## Troubleshooting

If the build fails on Hugging Face:
- Check the **Logs** tab for errors
- Make sure the `TMDB_API_KEY` secret is set correctly
- The Dockerfile should be using Node 20 (`FROM node:20-slim`)

## Files Modified

- **scraper.js**: Now uses TMDB API instead of web scraping
- **index.js**: Simplified to work with TMDB data format
- **package.json**: Removed `cheerio` dependency
- **README.md**: Updated documentation
