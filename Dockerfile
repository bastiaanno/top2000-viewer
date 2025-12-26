# Simple production container for Top2000 viewer
FROM node:24-alpine

# Create app directory
WORKDIR /app

# Set timezone
RUN apk add --no-cache tzdata
ENV TZ=Europe/Amsterdam

# Install prod dependencies first for better caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Ensure app files are owned by the non-root runtime user
RUN chown -R node:node /app

# Use non-root user provided by the base image
USER node

# Expose HTTPS port as defined in config.json (default 3001)
EXPOSE 3001

ENV NODE_ENV=production
CMD ["npm", "start"]
