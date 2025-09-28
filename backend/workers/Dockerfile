FROM node:18

# Install necessary system dependencies for OCR and PDF processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-ces \
    tesseract-ocr-eng \
    poppler-utils \
    imagemagick \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create non-root user
RUN groupadd -g 1001 nodejs
RUN useradd -r -u 1001 -g nodejs temporal

# Change to non-root privilege
USER temporal

# Expose health check port (if needed)
EXPOSE 3000

CMD ["npm", "start"]

