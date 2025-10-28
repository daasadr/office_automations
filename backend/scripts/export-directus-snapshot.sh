#!/bin/bash

# Export Directus Complete Snapshot (Schema + Policies)
# This script exports both the schema and policies/permissions from Directus

set -e  # Exit on any error

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
DIRECTUS_CONTAINER="directus"
POSTGRES_CONTAINER="postgres"
SCHEMA_DIR="$PROJECT_ROOT/docker/directus/schema"
POLICIES_DIR="$PROJECT_ROOT/docker/directus/policies"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if directus container exists and is running
DIRECTUS_RUNNING=$(docker ps --format '{{.Names}}' | grep -E "^${DIRECTUS_CONTAINER}$" || true)

if [ -z "$DIRECTUS_RUNNING" ]; then
    log_error "Directus container not found (looking for: ${DIRECTUS_CONTAINER})"
    log_info "Please start the services with: docker compose up -d"
    exit 1
fi

# Check if postgres container exists and is running
POSTGRES_RUNNING=$(docker ps --format '{{.Names}}' | grep -E "^${POSTGRES_CONTAINER}$" || true)

if [ -z "$POSTGRES_RUNNING" ]; then
    log_error "PostgreSQL container not found (looking for: ${POSTGRES_CONTAINER})"
    exit 1
fi

log_info "Starting Directus complete snapshot export..."
log_info "Directus container: ${DIRECTUS_CONTAINER}"
log_info "PostgreSQL container: ${POSTGRES_CONTAINER}"
echo ""

# Create directories if they don't exist
mkdir -p "$SCHEMA_DIR"
mkdir -p "$POLICIES_DIR"

# ====================
# Export Schema
# ====================
log_info "📊 Exporting schema snapshot..."

# Export to container
if docker exec "$DIRECTUS_CONTAINER" npx directus schema snapshot --format json /tmp/directus_schema_snapshot.json 2>&1 | grep -q "Snapshot saved"; then
    # Copy from container
    docker cp "${DIRECTUS_CONTAINER}:/tmp/directus_schema_snapshot.json" "$SCHEMA_DIR/directus11_schema_snapshot_simplified.json"
    
    # Clean up container
    docker exec "$DIRECTUS_CONTAINER" rm /tmp/directus_schema_snapshot.json 2>/dev/null || true
    
    log_success "Schema snapshot exported to: docker/directus/schema/directus11_schema_snapshot_simplified.json"
else
    log_error "Failed to export schema snapshot"
    exit 1
fi

# ====================
# Export Policies
# ====================
echo ""
log_info "🔐 Exporting policies snapshot..."

# Export policies using SQL
cat > /tmp/export_policies.sql << 'EOF'
\t
\a
\o /tmp/directus_roles.json
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM directus_roles ORDER BY name) t;
\o /tmp/directus_policies.json
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM directus_policies ORDER BY name) t;
\o /tmp/directus_access.json
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM directus_access ORDER BY id) t;
\o /tmp/directus_permissions.json
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM directus_permissions ORDER BY policy, collection, action) t;
\o
EOF

# Execute SQL export
docker exec -i "$POSTGRES_CONTAINER" psql -U app -d app -f /dev/stdin < /tmp/export_policies.sql >/dev/null 2>&1

# Combine into single JSON file using Python
docker exec "$POSTGRES_CONTAINER" python3 << 'EOF'
import json
from datetime import datetime

# Read all the JSON files
with open("/tmp/directus_roles.json", "r") as f:
    roles = json.loads(f.read().strip())
with open("/tmp/directus_policies.json", "r") as f:
    policies = json.loads(f.read().strip())
with open("/tmp/directus_access.json", "r") as f:
    access = json.loads(f.read().strip())
with open("/tmp/directus_permissions.json", "r") as f:
    permissions = json.loads(f.read().strip())

# Combine into single structure
combined = {
    "exported_at": datetime.now().isoformat(),
    "directus_version": "11.9.1",
    "vendor": "postgres",
    "roles": roles,
    "policies": policies,
    "access": access,
    "permissions": permissions
}

# Write to file
with open("/tmp/directus_policies_snapshot.json", "w") as f:
    json.dump(combined, f, indent=2)

print(f"Exported: {len(roles)} roles, {len(policies)} policies, {len(access)} access entries, {len(permissions)} permissions")
EOF

# Copy from container
docker cp "${POSTGRES_CONTAINER}:/tmp/directus_policies_snapshot.json" "$POLICIES_DIR/directus_policies_snapshot.json"

# Clean up
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/directus_*.json 2>/dev/null || true
rm -f /tmp/export_policies.sql

log_success "Policies snapshot exported to: docker/directus/policies/directus_policies_snapshot.json"

# ====================
# Summary
# ====================
echo ""
log_success "✅ Complete snapshot export finished!"
echo ""
log_info "📦 Exported files:"
log_info "   • Schema: docker/directus/schema/directus11_schema_snapshot_simplified.json"
log_info "   • Policies: docker/directus/policies/directus_policies_snapshot.json"
echo ""
log_info "💡 To import these snapshots:"
log_info "   • Full import: ./backend/scripts/import-directus-schema.sh"
log_info "   • Quick import: ./backend/scripts/quick-import-schema.sh"
log_info "   • Policies only: ./backend/scripts/import-directus-policies.sh"
echo ""

