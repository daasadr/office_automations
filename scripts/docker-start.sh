#!/bin/bash

# Docker Compose startup script with proper environment file loading
# This script loads all three environment files to avoid variable substitution warnings

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Starting Office Automation Stack"
echo ""

# Check if required env files exist
missing_files=()

if [ ! -f ".env" ]; then
    missing_files+=("Root .env")
fi

if [ ! -f "backend/.env" ]; then
    missing_files+=("backend/.env")
fi

if [ ! -f "frontend/.env" ]; then
    missing_files+=("frontend/.env")
fi

if [ ${#missing_files[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing environment files:${NC}"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Please run:"
    echo "  ./setup.sh                     # For root .env"
    echo "  cp backend/env.template backend/.env"
    echo "  cp frontend/env.template frontend/.env"
    exit 1
fi

echo -e "${GREEN}✓${NC} All environment files found"
echo ""

# Export variables from all env files to avoid warnings
echo "Loading environment variables..."

# Function to load env file
load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        export $(grep -v '^#' "$env_file" | grep -v '^$' | xargs)
    fi
}

# Load all env files
load_env ".env"
load_env "backend/.env"
load_env "frontend/.env"

echo -e "${GREEN}✓${NC} Environment variables loaded"
echo ""

# Parse command line arguments
COMMAND=${1:-up}
shift || true

# Run docker compose with the command
echo "Running: docker compose $COMMAND $@"
echo ""

docker compose "$COMMAND" "$@"

echo ""
echo -e "${GREEN}✓${NC} Command completed"

