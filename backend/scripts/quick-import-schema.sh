#!/bin/bash

# Quick Directus Schema Import (No prompts)
# for CI/CD 

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTAINER_NAME="${PROJECT_PREFIX:-spur_odpady_}-directus"
SCHEMA_FILE="$PROJECT_ROOT/automation/directus/directus11_schema_snapshot.json"

echo "🚀 Quick importing Directus schema..."

# Check if files exist
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Schema file not found: $SCHEMA_FILE"
    exit 1
fi

# Check if container exists and is running
CONTAINER_PATTERN="spur_odpady[_-]directus"
RUNNING_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "^${CONTAINER_PATTERN}$")

if [ -z "$RUNNING_CONTAINER" ]; then
    echo "❌ Directus container not found (looking for pattern: ${CONTAINER_PATTERN})"
    echo "Start with: docker compose up -d"
    exit 1
fi

# Use the actual running container name
CONTAINER_NAME="$RUNNING_CONTAINER"
echo "✅ Found running container: ${CONTAINER_NAME}"

# Backup current schema
echo "📦 Creating backup..."
docker exec "$CONTAINER_NAME" npx directus schema snapshot "/directus/snapshots/backup-$(date +%F_%H-%M-%S).json" >/dev/null 2>&1 || echo "⚠️  Backup failed (normal for fresh install)"

# Copy and apply schema
echo "📋 Copying schema..."
docker cp "$SCHEMA_FILE" "${CONTAINER_NAME}:/directus/snapshots/import.json"

echo "✨ Applying schema..."
docker exec "$CONTAINER_NAME" npx directus schema apply --yes "/directus/snapshots/import.json"

# Cleanup
docker exec "$CONTAINER_NAME" rm -f "/directus/snapshots/import.json" 2>/dev/null || true

echo "✅ Schema import completed!"
echo "🌐 Access Directus: http://localhost:8055"

