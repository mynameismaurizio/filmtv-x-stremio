FROM node:20-slim

# Install git (needed to clone from GitHub)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone the repository from GitHub
RUN git clone https://github.com/mynameismaurizio/filmtv-x-stremio.git .

# Install dependencies
RUN npm install --production

# Expose port (Hugging Face uses 7860 by default)
EXPOSE 7860

# Set environment variable for port
ENV PORT=7860

# Start the addon
CMD ["npm", "start"]
