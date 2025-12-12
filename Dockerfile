FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Expose port (Railway/Render set PORT automatically, HF uses 7860)
EXPOSE ${PORT:-7860}

# Start the addon
CMD ["npm", "start"]
