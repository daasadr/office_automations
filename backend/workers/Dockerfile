FROM node:18-alpine

# Install necessary system dependencies for OCR and PDF processing
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-ces \
    tesseract-ocr-data-eng \
    poppler-utils \
    imagemagick \
    python3 \
    py3-pip \
    build-base

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S temporal -u 1001

# Change to non-root privilege
USER temporal

# Expose health check port (if needed)
EXPOSE 3000

CMD ["npm", "start"]
