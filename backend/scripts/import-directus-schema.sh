#!/bin/bash

# Import Directus Schema Script
# This script imports the Directus schema snapshot into the running Directus container

set -e  # Exit on any error

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
CONTAINER_NAME="${PROJECT_PREFIX:-office-automation_}-directus"
SCHEMA_FILE="$PROJECT_ROOT/automation/directus/directus11_schema_snapshot.json"
BACKUP_DIR="/directus/snapshots"
CONTAINER_SCHEMA_PATH="/directus/snapshots/schema_import.json"

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

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    log_error "Schema file not found: $SCHEMA_FILE"
    log_error "Expected location: automation/directus/directus11_schema_snapshot.json"
    log_error "Current working directory: $(pwd)"
    log_error "Project root: $PROJECT_ROOT"
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if container exists and is running
CONTAINER_PATTERN="office-automation[_-]directus"
RUNNING_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "^${CONTAINER_PATTERN}$")

if [ -z "$RUNNING_CONTAINER" ]; then
    log_error "Directus container not found (looking for pattern: ${CONTAINER_PATTERN})"
    log_info "Please start the services with: docker compose up -d"
    exit 1
fi

# Use the actual running container name
CONTAINER_NAME="$RUNNING_CONTAINER"
log_info "Found running container: ${CONTAINER_NAME}"

log_info "Starting Directus schema import process..."
log_info "Project root: ${PROJECT_ROOT}"
log_info "Container: ${CONTAINER_NAME}"
log_info "Schema file: ${SCHEMA_FILE}"

# Step 1: Create snapshots directory in container if it doesn't exist
log_info "Creating snapshots directory in container..."
docker exec "$CONTAINER_NAME" mkdir -p "$BACKUP_DIR" 2>/dev/null || true

# Step 2: Backup current schema (optional but recommended)
BACKUP_FILE="backup-$(date +%F_%H-%M-%S).json"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

log_info "Creating backup of current schema..."
if docker exec "$CONTAINER_NAME" npx directus schema snapshot "$BACKUP_PATH" >/dev/null 2>&1; then
    log_success "Current schema backed up to: ${BACKUP_PATH}"
else
    log_warning "Failed to create schema backup (this is normal for fresh installations)"
fi

# Step 3: Copy schema file to container
log_info "Copying schema file to container..."
if docker cp "$SCHEMA_FILE" "${CONTAINER_NAME}:${CONTAINER_SCHEMA_PATH}"; then
    log_success "Schema file copied to container"
else
    log_error "Failed to copy schema file to container"
    exit 1
fi

# Step 4: Show schema diff (optional)
log_info "Checking schema differences..."
if docker exec "$CONTAINER_NAME" npx directus schema diff "$CONTAINER_SCHEMA_PATH" 2>/dev/null; then
    echo ""
    read -p "Do you want to proceed with the schema import? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Schema import cancelled by user"
        exit 0
    fi
else
    log_warning "Could not generate schema diff (this is normal for fresh installations)"
fi

# Step 5: Apply the schema
log_info "Applying schema to Directus..."
if docker exec "$CONTAINER_NAME" npx directus schema apply --yes "$CONTAINER_SCHEMA_PATH"; then
    log_success "Schema applied successfully!"
else
    log_error "Failed to apply schema"
    log_info "You can restore the backup with:"
    log_info "docker exec $CONTAINER_NAME npx directus schema apply --yes $BACKUP_PATH"
    exit 1
fi

# Step 6: Verify the schema was applied
log_info "Verifying schema application..."
if docker exec "$CONTAINER_NAME" npx directus schema diff "$CONTAINER_SCHEMA_PATH" >/dev/null 2>&1; then
    log_warning "Schema differences still exist - manual review may be needed"
else
    log_success "Schema successfully applied with no differences"
fi

# Step 7: Cleanup
log_info "Cleaning up temporary files..."
docker exec "$CONTAINER_NAME" rm -f "$CONTAINER_SCHEMA_PATH" 2>/dev/null || true

# Final success message
echo ""
log_success "✅ Directus schema import completed!"
log_info "📊 Collections imported:"
log_info "   • documents - Document management"
log_info "   • email_messages - Email processing"
log_info "   • email_attachments - Email attachments"
log_info "   • extraction_jobs - Processing jobs"
log_info "   • artifacts - Document artifacts"
log_info "   • extractions - Extracted data"
log_info "   • extraction_fields - Field definitions"
log_info "   • review_tasks - Human review tasks"
log_info "   • exports - Export records"
log_info "   • deliveries - Delivery tracking"
log_info "   • integration_targets - External systems"
log_info "   • schema_definitions - Schema versions"
log_info "   • master_vendors - Vendor master data"
log_info "   • activity_log - System activity"
echo ""
log_info "🌐 Access Directus at: http://localhost:8055"
log_info "📈 Temporal UI at: http://localhost:8085"

if [ -n "$BACKUP_FILE" ]; then
    echo ""
    log_info "💾 Your original schema backup: ${BACKUP_PATH}"
    log_info "   Restore with: docker exec $CONTAINER_NAME npx directus schema apply --yes $BACKUP_PATH"
fi