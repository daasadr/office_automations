#!/bin/bash
# Sync backend environment variables to root .env for Docker Compose
# Docker Compose requires variables in the root .env for ${VAR} substitution

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_ENV="${ROOT_DIR}/.env"
BACKEND_ENV="${ROOT_DIR}/backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
    echo "Error: backend/.env not found. Please create it first:"
    echo "  cp backend/env.template backend/.env"
    exit 1
fi

if [ ! -f "$ROOT_ENV" ]; then
    echo "Error: .env not found. Please create it first:"
    echo "  cp env.template .env"
    exit 1
fi

# Create a temporary file with the root .env without backend variables
TEMP_ENV="${ROOT_DIR}/.env.tmp"
awk '
    /^# ============================================================================$/ {
        if (getline next_line > 0) {
            if (next_line ~ /^# BACKEND SERVICES/) {
                skip = 1
            } else {
                print
                print next_line
                next
            }
        }
    }
    !skip { print }
    /^$/ && skip { skip = 0; next }
' "$ROOT_ENV" > "$TEMP_ENV"

# Append backend variables
echo "" >> "$TEMP_ENV"
echo "# ============================================================================" >> "$TEMP_ENV"
echo "# BACKEND SERVICES (auto-synced from backend/.env)" >> "$TEMP_ENV"
echo "# Run ./sync-env.sh after updating backend/.env" >> "$TEMP_ENV"
echo "# ============================================================================" >> "$TEMP_ENV"
grep -E "^[A-Z_]+=.*$" "$BACKEND_ENV" | grep -v "^#" >> "$TEMP_ENV"

# Replace the original file
mv "$TEMP_ENV" "$ROOT_ENV"

echo "✓ Backend environment variables synced to root .env"
echo "  Run 'docker-compose up -d' to apply changes"

