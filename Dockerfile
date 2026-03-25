# Lightweight Node.js image (No Chromium needed for Telegram!)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose the health check port
EXPOSE 3000

# Start the Telegram bot
CMD ["node", "bot.js"]
