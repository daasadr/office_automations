#!/bin/bash

# PostgreSQL Database Backup Script
# This script creates a SQL dump of the PostgreSQL database and saves it to sql_backups directory

set -e  # Exit on any error

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
POSTGRES_CONTAINER="postgres"
BACKUP_DIR="$SCRIPT_DIR/sql_backups"

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

# Check if postgres container exists and is running
POSTGRES_RUNNING=$(docker ps --format '{{.Names}}' | grep -E "^${POSTGRES_CONTAINER}$" || true)

if [ -z "$POSTGRES_RUNNING" ]; then
    log_error "PostgreSQL container not found (looking for: ${POSTGRES_CONTAINER})"
    log_info "Please start the services with: docker compose up -d"
    exit 1
fi

log_info "Found running container: ${POSTGRES_RUNNING}"

# Load environment variables from .env file if it exists
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    log_info "Loading environment variables from .env file..."
    # Source the .env file, but only export variables that start with POSTGRES_ or DB_
    set -a
    source "$ENV_FILE" 2>/dev/null || true
    set +a
fi

# Get database credentials from environment variables with defaults
DB_NAME="${POSTGRES_DB:-${DB_DATABASE:-directus}}"
DB_USER="${POSTGRES_USER:-${DB_USER:-directus}}"
DB_PASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-}}"

log_info "Database configuration:"
log_info "  Container: ${POSTGRES_RUNNING}"
log_info "  Database: ${DB_NAME}"
log_info "  User: ${DB_USER}"

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    log_info "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "$BACKUP_DIR"
fi

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="backup_${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"

log_info "Starting PostgreSQL backup..."
log_info "Backup file: ${BACKUP_FILENAME}"

# Perform the backup using pg_dump inside the container
# Using PGPASSWORD environment variable for password authentication
if [ -n "$DB_PASSWORD" ]; then
    log_info "Creating database dump..."
    if docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_RUNNING" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --verbose \
        > "$BACKUP_PATH" 2>&1; then
        log_success "Database backup created successfully!"
    else
        log_error "Failed to create database backup"
        # Remove empty or failed backup file
        [ -f "$BACKUP_PATH" ] && rm -f "$BACKUP_PATH"
        exit 1
    fi
else
    log_warning "No password found in environment variables, attempting backup without password..."
    if docker exec "$POSTGRES_RUNNING" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --verbose \
        > "$BACKUP_PATH" 2>&1; then
        log_success "Database backup created successfully!"
    else
        log_error "Failed to create database backup"
        log_error "Please ensure POSTGRES_PASSWORD is set in your .env file"
        # Remove empty or failed backup file
        [ -f "$BACKUP_PATH" ] && rm -f "$BACKUP_PATH"
        exit 1
    fi
fi

# Check if backup file was created and has content
if [ ! -f "$BACKUP_PATH" ]; then
    log_error "Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log_info "Backup file size: ${BACKUP_SIZE}"

# Compress the backup (optional - creates .sql.gz file)
log_info "Compressing backup..."
if gzip -f "$BACKUP_PATH"; then
    COMPRESSED_FILENAME="${BACKUP_FILENAME}.gz"
    COMPRESSED_PATH="$BACKUP_DIR/$COMPRESSED_FILENAME"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
    log_success "Backup compressed: ${COMPRESSED_FILENAME} (${COMPRESSED_SIZE})"
    log_info "Full path: ${COMPRESSED_PATH}"
else
    log_warning "Compression failed, keeping uncompressed backup"
    log_info "Full path: ${BACKUP_PATH}"
fi

# Final success message
echo ""
log_success "✅ PostgreSQL backup completed!"
log_info "📁 Backup location: ${BACKUP_DIR}"
if [ -f "$COMPRESSED_PATH" ]; then
    log_info "📦 Compressed backup: ${COMPRESSED_FILENAME}"
else
    log_info "📦 Backup file: ${BACKUP_FILENAME}"
fi
echo ""

# Optional: Show how to restore
log_info "To restore this backup, use:"
if [ -f "$COMPRESSED_PATH" ]; then
    log_info "  gunzip < ${COMPRESSED_PATH} | docker exec -i ${POSTGRES_RUNNING} psql -U ${DB_USER} -d ${DB_NAME}"
else
    log_info "  docker exec -i ${POSTGRES_RUNNING} psql -U ${DB_USER} -d ${DB_NAME} < ${BACKUP_PATH}"
fi
echo ""

