# Use official Node.js runtime as base image
FROM node:18-alpine

# Build arguments (used by Coolify)
ARG SOURCE_COMMIT
ARG COOLIFY_URL
ARG COOLIFY_FQDN
ARG SERVICE_FQDN_ZENAYEHA
ARG SERVICE_URL_ZENAYEHA

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy Vazirmatn fonts directory first (for better layer caching)
COPY Vazirmatn/ ./Vazirmatn/

# Copy all other application files (excluding node_modules which is ignored by .dockerignore)
# This includes HTML, CSS, JS, server.js, Icon.png, etc.
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]

