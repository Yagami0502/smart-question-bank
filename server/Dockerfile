# MindForge backend API image
FROM node:22-bookworm-slim

WORKDIR /app

# Install production dependencies first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

EXPOSE 3001

CMD ["node", "index.js"]
