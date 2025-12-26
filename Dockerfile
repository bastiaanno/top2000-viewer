# Simple production container for Top2000 viewer
FROM node:24-alpine

# Create app directory
WORKDIR /app

# Install prod dependencies first for better caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Use non-root user provided by the base image
USER node

# Expose HTTPS port as defined in config.json (default 3001)
EXPOSE 3001

ENV NODE_ENV=production
CMD ["npm", "start"]
