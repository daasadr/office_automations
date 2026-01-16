# Multi-stage build for Astro frontend application

# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app

# Install git (required by some npm packages)
RUN apk add --no-cache git

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies using npm ci for reproducible builds
RUN npm ci --verbose
RUN npm install --save-optional @rollup/rollup-linux-x64-musl
RUN npm install --save-optional piccolore

# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app

# Accept build arguments
ARG PUBLIC_BASE_PATH=/gFF1cnio0udVeqRarLTy
ENV PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the Astro application
RUN npm run build

# Stage 3: Production runner
FROM node:24-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Copy node_modules from deps stage (already has all dependencies)
COPY --from=deps /app/node_modules ./node_modules

# Expose the port the app runs on
EXPOSE 4321

# Set the host to allow external connections
ENV HOST=0.0.0.0
ENV PORT=4321

# Start the application
CMD ["node", "./dist/server/entry.mjs"]

