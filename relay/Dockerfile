# Use a slim Node.js LTS base image
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy the shared directory (from repo root)
COPY shared/ ./shared/

# Copy the relay directory
COPY relay/ ./relay/

# Set working directory to relay for dependency installation
WORKDIR /app/relay

# Install production dependencies for relay
RUN npm install --production

# Install dependencies for shared (since relay likely depends on it)
WORKDIR /app/shared
RUN npm install --production

# Return to relay directory
WORKDIR /app/relay

# Expose the port (default 8080)
EXPOSE 8080

# Environment variables
ENV PORT=8080

# Start the relay server
CMD ["npm", "start"]
