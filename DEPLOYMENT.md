# Deployment Instructions

## GitHub Setup

### 1. Initialize Git Repository with GitHub Desktop

1. Open **GitHub Desktop**
2. Click **File** → **Add Local Repository**
3. Click **Choose...** and navigate to:
   ```
   /Users/roccogimondi/Desktop/GD/Works/Dev:CODE/stremio-filmtv-addon
   ```
4. Click **Add Repository**
5. If prompted that this directory is not a Git repository, click **Create a Repository**
6. In the "Create a Repository" dialog:
   - Name: `filmtv-x-stremio`
   - Description: `FilmTV.it Stremio addon`
   - Keep "Initialize this repository with a README" **unchecked** (we already have one)
   - Click **Create Repository**

### 2. Create Initial Commit

1. In GitHub Desktop, you should see all your files listed in the "Changes" tab
2. In the bottom left, enter commit message:
   ```
   Initial commit: FilmTV.it Stremio addon
   ```
3. Click **Commit to main**

### 3. Connect to Your GitHub Repository

Since you've already created the `filmtv-x-stremio` repository on GitHub:

1. In GitHub Desktop, click **Publish repository** in the top bar
2. In the dialog:
   - Repository name: `filmtv-x-stremio`
   - Description: `FilmTV.it Stremio addon`
   - Keep **"Keep this code private"** **unchecked** (make it public)
   - Click **Publish Repository**

Your local repository is now connected to GitHub!

## Hugging Face Deployment

### 1. Create Hugging Face Space

1. Go to [https://huggingface.co/new-space](https://huggingface.co/new-space)
2. Name your space: `filmtv-x-stremio`
3. Select **Docker** as the SDK
4. Choose **Public** visibility
5. Click "Create Space"

### 2. Link GitHub Repository to Hugging Face

**Recommended Method:** Link your GitHub repository directly in Hugging Face:

1. In your Hugging Face Space, go to **Settings** tab
2. Scroll to **"Repository"** section
3. Under **"Connect to GitHub"**, click **"Link to GitHub repository"**
4. Select your `filmtv-x-stremio` repository
5. Hugging Face will automatically sync from GitHub

**Note:** GitHub Desktop doesn't support multiple Git remotes easily. Using the GitHub → Hugging Face sync is the simplest approach. Any changes you push to GitHub will automatically deploy to Hugging Face.

### 3. Wait for Build

Hugging Face will automatically:
- Build the Docker container
- Install dependencies
- Start the addon on port 7860

This takes about 5-10 minutes on first deployment.

### 4. Access Your Addon

Once deployed, your addon will be available at:
```
https://YOUR_HF_USERNAME-filmtv-x-stremio.hf.space
```

The manifest URL for Stremio will be:
```
https://YOUR_HF_USERNAME-filmtv-x-stremio.hf.space/manifest.json
```

## Installing in Stremio

1. Open Stremio
2. Click on the addons icon (puzzle piece) in the top right
3. Click on "Community Addons" at the bottom
4. Enter your manifest URL:
   ```
   https://YOUR_HF_USERNAME-filmtv-x-stremio.hf.space/manifest.json
   ```
5. Click "Install"

You should now see "FilmTV.it Lists" in your Stremio board with catalogs for Best of 2023, 2024, and 2025!

## Testing Locally

Before deploying, you can test locally:

```bash
cd "/Users/roccogimondi/Desktop/GD/Works/Dev:CODE/stremio-filmtv-addon"
npm install
PORT=7001 npm start
```

Then open Stremio and install the addon using:
```
http://localhost:7001/manifest.json
```

## Troubleshooting

- **Port 7000 in use**: Use `PORT=7001 npm start` instead
- **Build fails on HF**: Check the "Logs" tab in your Space
- **No movies showing**: The scraper may need updates if FilmTV.it changes their HTML structure
- **Addon not appearing in Stremio**: Make sure the manifest URL is correct and accessible

## Updating the Addon

When you make changes to your code:

1. Open **GitHub Desktop**
2. You'll see your changes listed in the **Changes** tab
3. Review the changes (you can see diffs by clicking on files)
4. Enter a commit message describing your changes (e.g., "Fix movie parsing bug")
5. Click **Commit to main**
6. Click **Push origin** in the top bar

If you've linked GitHub to Hugging Face (recommended), Hugging Face will automatically detect the changes and rebuild/redeploy your addon within a few minutes.
