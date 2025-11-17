# IMPORTANT: How to Use This Addon

## ⚠️ CRITICAL: Localhost Does NOT Work!

**Stremio CANNOT access `localhost` or `127.0.0.1`**

You MUST deploy this addon to a public server to use it with Stremio.

## Steps to Make It Work:

### 1. Deploy to Hugging Face Spaces

1. Go to https://huggingface.co/new-space
2. Create a new Space with Docker
3. Upload all your files
4. Set environment variable: `TMDB_API_KEY=your_key_here`
5. Wait for deployment to complete

### 2. Configure the Addon

1. Visit: `https://your-space-name.hf.space/configure`
2. Enter your TMDB API key
3. Select catalogs
4. Click "Salva"
5. Click "Installa in Stremio"

### 3. What Happens Next

Stremio will open and install the addon with your configuration.

## Why Localhost Fails

When you try to use `http://localhost:7001`, Stremio sees this error:

```
Error: failed fetched media
```

This is because:
- Stremio runs as a separate application
- It cannot access YOUR computer's localhost
- It needs a URL that's accessible from the internet

## Testing Locally

If you want to test locally, you can:

1. Use `curl` to test endpoints:
   ```bash
   curl http://localhost:7001/manifest.json
   ```

2. But you CANNOT install it in Stremio from localhost

## Files You Need for Deployment

- `index.js` - Main server
- `scraper.js` - FilmTV scraper
- `configure.html` - Configuration page
- `package.json` - Dependencies
- `Dockerfile` - For Docker deployment

## Environment Variables

Set these on your deployment platform:

- `TMDB_API_KEY` - Your TMDB API key (optional, can be set via configure page)
- `PORT` - Port to run on (default: 7000)

## Support

If you're still having issues, make sure:
1. ✅ You're using a PUBLIC URL (not localhost)
2. ✅ The server is running and accessible
3. ✅ You've entered a valid TMDB API key
4. ✅ You're using the /configure page from the PUBLIC URL
