# Stage 1: Build the frontend Vite application
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Create the production server image
FROM node:22-alpine
WORKDIR /app

# Copy package descriptors and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend application source files
COPY server.js db.js scheduler.js ./
COPY lib/ ./lib
COPY data/ ./data
COPY middleware/ ./middleware
COPY routes/ ./routes

# Copy the compiled static frontend files from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the application port
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/zonekeeper.db

# Create a data directory for mounting a persistent SQLite database volume
RUN mkdir -p /app/data

# Enable docker container healthchecks
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Run the server
CMD ["node", "server.js"]
