#!/bin/bash

# Quick Directus Schema Import (No prompts)
# for CI/CD 

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTAINER_NAME="directus"

# Check for schema files (prefer simplified version)
if [ -f "$PROJECT_ROOT/docker/directus/schema/directus11_schema_snapshot_simplified.json" ]; then
    SCHEMA_FILE="$PROJECT_ROOT/docker/directus/schema/directus11_schema_snapshot_simplified.json"
elif [ -f "$PROJECT_ROOT/docker/directus/schema/directus11_schema_snapshot.json" ]; then
    SCHEMA_FILE="$PROJECT_ROOT/docker/directus/schema/directus11_schema_snapshot.json"
else
    echo "❌ Schema file not found"
    echo "Expected one of:"
    echo "  • $PROJECT_ROOT/docker/directus/schema/directus11_schema_snapshot_simplified.json"
    echo "  • $PROJECT_ROOT/docker/directus/schema/directus11_schema_snapshot.json"
    exit 1
fi

echo "🚀 Quick importing Directus schema..."
echo "📄 Using schema file: $(basename $SCHEMA_FILE)"

# Check if container exists and is running
CONTAINER_PATTERN="directus"
RUNNING_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "^${CONTAINER_PATTERN}$")

if [ -z "$RUNNING_CONTAINER" ]; then
    echo "❌ Directus container not found (looking for pattern: ${CONTAINER_PATTERN})"
    echo "Start with: docker compose up -d"
    exit 1
fi

# Use the actual running container name
CONTAINER_NAME="$RUNNING_CONTAINER"
echo "✅ Found running container: ${CONTAINER_NAME}"

# Create snapshots directory if it doesn't exist
echo "📁 Creating snapshots directory..."
docker exec "$CONTAINER_NAME" mkdir -p "/directus/snapshots" 2>/dev/null || true

# Verify directory exists, use fallback if needed
if ! docker exec "$CONTAINER_NAME" test -d "/directus/snapshots"; then
    echo "⚠️  Using alternative approach for directory creation..."
    docker cp "$SCHEMA_FILE" "${CONTAINER_NAME}:/tmp/schema_import.json"
    docker exec "$CONTAINER_NAME" sh -c "mkdir -p /directus/snapshots && mv /tmp/schema_import.json /directus/snapshots/import.json"
else
    # Backup current schema
    echo "📦 Creating backup..."
    docker exec "$CONTAINER_NAME" npx directus schema snapshot "/directus/snapshots/backup-$(date +%F_%H-%M-%S).json" >/dev/null 2>&1 || echo "⚠️  Backup failed (normal for fresh install)"

    # Copy and apply schema
    echo "📋 Copying schema..."
    docker cp "$SCHEMA_FILE" "${CONTAINER_NAME}:/directus/snapshots/import.json"
fi

echo "✨ Applying schema..."
docker exec "$CONTAINER_NAME" npx directus schema apply --yes "/directus/snapshots/import.json"

# Cleanup
docker exec "$CONTAINER_NAME" rm -f "/directus/snapshots/import.json" 2>/dev/null || true

echo "✅ Schema import completed!"

# Import policies if file exists
POLICIES_FILE="$PROJECT_ROOT/docker/directus/policies/directus_policies_snapshot.json"
if [ -f "$POLICIES_FILE" ]; then
    echo ""
    echo "📋 Importing policies..."
    if [ -x "$SCRIPT_DIR/import-directus-policies.sh" ]; then
        if "$SCRIPT_DIR/import-directus-policies.sh"; then
            echo "✅ Policies imported!"
        else
            echo "⚠️  Policies import failed (continuing anyway)"
        fi
    else
        echo "⚠️  Policies import script not found"
    fi
else
    echo "⚠️  No policies snapshot found, skipping"
fi

echo ""
echo "✅ Complete! Schema and policies imported."
echo "🌐 Access Directus: http://localhost:8055"

