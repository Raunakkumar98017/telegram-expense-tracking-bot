# Use a Node image with Chromium dependencies pre-installed
FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Switch to root to install any missing dependencies (if needed)
USER root

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port for Render health checks
EXPOSE 3000

# Start the bot
CMD ["node", "bot.js"]
