# 🚀 How to Host on Hugging Face Spaces

This guide will walk you through deploying your FilmTV.it Stremio addon to Hugging Face Spaces.

## Prerequisites

- ✅ Your code is ready to deploy
- ✅ A Hugging Face account (sign up at https://huggingface.co/join)
- ✅ A GitHub repository with your code (optional, but recommended)

## Step 1: Create or Access Your Hugging Face Space

### Option A: Create a New Space

1. Go to [https://huggingface.co/new-space](https://huggingface.co/new-space)
2. Fill in the details:
   - **Space name**: `filmtv-x-stremio` (or your preferred name)
   - **SDK**: Select **Docker** 
   - **Visibility**: Choose **Public** (required for Stremio to access it)
3. Click **"Create Space"**

### Option B: Access Existing Space

If you already have a Space:
1. Go to [https://huggingface.co/spaces/cacaspruz/filmtv-x-stremio](https://huggingface.co/spaces/cacaspruz/filmtv-x-stremio)
2. Make sure you're logged in with the account that owns the Space

## Step 2: Upload Your Code

### Method 1: Connect to GitHub (Recommended)

This automatically syncs your code from GitHub:

1. In your Hugging Face Space, go to the **Settings** tab
2. Scroll to the **"Repository"** section
3. Under **"Connect to GitHub"**, click **"Link to GitHub repository"**
4. Select your `filmtv-x-stremio` repository
5. Hugging Face will automatically sync and rebuild when you push to GitHub

**To push code to GitHub:**
- Use GitHub Desktop to commit and push your changes
- Or use git commands if you have them installed

### Method 2: Upload Files Directly

1. In your Hugging Face Space, go to the **Files and versions** tab
2. Click **"Add file"** → **"Upload files"**
3. Upload these essential files:
   - `index.js`
   - `scraper.js`
   - `package.json`
   - `package-lock.json`
   - `Dockerfile`
   - `README_HF.md` (or rename it to `README.md`)
   - Any image files (`.png` files for logo/background)

## Step 3: Set Environment Variables

Your addon needs a TMDB API key to work:

1. In your Hugging Face Space, go to the **Settings** tab
2. Scroll to **"Variables and secrets"** section
3. Under **"Secrets"**, click **"New secret"**
4. Add:
   - **Name**: `TMDB_API_KEY`
   - **Value**: Your TMDB API key (get one from https://www.themoviedb.org/settings/api)
5. Click **Save**

**Note:** If you don't have a TMDB API key:
- Go to https://www.themoviedb.org
- Create a free account
- Go to Settings → API
- Request an API key
- Copy the key (32 characters)

## Step 4: Verify Your Files

Make sure these files are in your Space:

- ✅ `Dockerfile` - Must use port 7860
- ✅ `package.json` - With all dependencies
- ✅ `index.js` - Main server file
- ✅ `scraper.js` - Scraper logic
- ✅ `README_HF.md` or `README.md` - With Hugging Face frontmatter

## Step 5: Deploy

### Automatic Deployment

If you connected to GitHub:
- Just push your code to GitHub
- Hugging Face will automatically detect changes and rebuild
- This takes 2-5 minutes

### Manual Deployment

If you uploaded files directly:
1. Go to your Space's main page
2. Click the **"App"** tab
3. Hugging Face will automatically start building
4. Watch the build logs in the **"Logs"** tab

## Step 6: Wait for Build

1. Go to the **"Logs"** tab in your Space
2. Watch for build progress
3. Look for: `FilmTV.it addon running on http://0.0.0.0:7860`
4. Build typically takes 2-5 minutes

## Step 7: Test Your Deployment

Once the build completes:

1. **Check the manifest:**
   ```
   https://YOUR_USERNAME-filmtv-x-stremio.hf.space/manifest.json
   ```
   Replace `YOUR_USERNAME` with your Hugging Face username (e.g., `cacaspruz`)

2. **Test a catalog endpoint:**
   ```
   https://YOUR_USERNAME-filmtv-x-stremio.hf.space/catalog/movie/filmtv-2024.json
   ```

3. **You should see JSON data with movies**

## Step 8: Install in Stremio

1. Open **Stremio**
2. Go to **Addons** (puzzle icon in top right)
3. Click **"Community Addons"** at the bottom
4. Paste your manifest URL:
   ```
   https://YOUR_USERNAME-filmtv-x-stremio.hf.space/manifest.json
   ```
5. Click **"Install"**

## Troubleshooting

### Build Fails

- Check the **Logs** tab for errors
- Verify `Dockerfile` is correct
- Make sure `package.json` has all dependencies
- Ensure Node version in Dockerfile matches your code (Node 20)

### Addon Not Working in Stremio

- Verify the Space is **Public** (not Private)
- Check that the manifest URL is accessible in a browser
- Make sure `TMDB_API_KEY` secret is set correctly
- Check logs for API errors

### No Movies Showing

- Verify `TMDB_API_KEY` is set correctly
- Check the logs for API errors
- Test the catalog endpoint directly in a browser
- Make sure the scraper is working (check logs)

### Port Issues

- Hugging Face uses port **7860** by default
- Your `Dockerfile` should expose port 7860
- Your `index.js` should use `process.env.PORT || 7860`

## Updating Your Addon

### If Connected to GitHub:

1. Make changes to your code locally
2. Commit and push to GitHub using GitHub Desktop
3. Hugging Face will automatically rebuild
4. Wait 2-5 minutes for deployment

### If Using Direct Upload:

1. Make changes to your code locally
2. Upload the changed files to Hugging Face
3. Go to Settings → **"Restart this Space"**
4. Wait for rebuild

## Your Space URL

Once deployed, your addon will be available at:
```
https://YOUR_USERNAME-filmtv-x-stremio.hf.space
```

Replace `YOUR_USERNAME` with your actual Hugging Face username.

## Quick Checklist

- [ ] Space created on Hugging Face
- [ ] Code uploaded (via GitHub or direct upload)
- [ ] `TMDB_API_KEY` secret added in Settings
- [ ] Build completed successfully
- [ ] Manifest URL accessible in browser
- [ ] Addon installed in Stremio
- [ ] Movies showing in Stremio

## Need Help?

- Check the **Logs** tab for detailed error messages
- Verify all files are uploaded correctly
- Make sure environment variables are set
- Test endpoints directly in a browser before installing in Stremio

