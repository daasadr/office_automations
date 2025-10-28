#!/bin/bash

# Office Automation - Complete Environment Setup
# Single command to set up dev or production environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_step() {
    echo ""
    echo -e "${CYAN}${BOLD}▶ $1${NC}"
    echo -e "${CYAN}$(echo "$1" | sed 's/./-/g')${NC}"
}

# Generate random secret
generate_secret() {
    local length=${1:-32}
    openssl rand -hex "$length" 2>/dev/null || cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w "$length" | head -n 1
}

generate_base64() {
    local length=${1:-32}
    openssl rand -base64 "$length" 2>/dev/null | tr -d '\n' || cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w "$length" | head -n 1
}

# Banner
clear
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                                        ║${NC}"
echo -e "${BOLD}║        Office Automation - Environment Setup          ║${NC}"
echo -e "${BOLD}║                                                        ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "This script will set up your complete environment:"
echo "  • Generate secure passwords and secrets"
echo "  • Configure environment files"
echo "  • Set up local domain (dev)"
echo "  • Start Docker services"
echo "  • Import Directus schema"
echo "  • Guide you through API token setup"
echo ""

# Check if Docker is running
log_info "Checking Docker engine..."
if ! docker info >/dev/null 2>&1; then
    echo ""
    log_error "Docker engine is not running!"
    echo ""
    echo "Please start Docker and try again:"
    echo ""
    echo "  ${CYAN}macOS:${NC}"
    echo "    • Open Docker Desktop application"
    echo "    • Wait for Docker to start (look for running whale icon)"
    echo ""
    echo "  ${CYAN}Linux:${NC}"
    echo "    sudo systemctl start docker"
    echo ""
    echo "  ${CYAN}Windows:${NC}"
    echo "    • Open Docker Desktop application"
    echo "    • Wait for Docker to start"
    echo ""
    echo "Then run this command again:"
    echo "  ${CYAN}make setup-dev${NC}"
    echo ""
    exit 1
fi
log_success "Docker engine is running"
echo ""

# Step 1: Choose environment
log_step "STEP 1: Choose Environment"
echo ""
echo "Select environment type:"
echo "  ${GREEN}1)${NC} Development (dev-dejtoai.local) - Hot reloading, debug logs"
echo "  ${GREEN}2)${NC} Production (dejtoai.cz) - Optimized builds, production mode"
echo ""
read -p "Enter choice [1-2]: " ENV_CHOICE

case $ENV_CHOICE in
    1)
        ENVIRONMENT="development"
        DOMAIN="dev-dejtoai.local"
        NODE_ENV="development"
        DOCKER_BUILD_TARGET="development"
        log_success "Development environment selected"
        ;;
    2)
        ENVIRONMENT="production"
        read -p "Enter production domain [dejtoai.cz]: " PROD_DOMAIN
        DOMAIN=${PROD_DOMAIN:-dejtoai.cz}
        NODE_ENV="production"
        DOCKER_BUILD_TARGET="production"
        log_success "Production environment selected: $DOMAIN"
        ;;
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

# Step 2: Generate secrets
log_step "STEP 2: Generate Secure Secrets"
echo ""
log_info "Generating cryptographically secure passwords and secrets..."

# PostgreSQL
POSTGRES_PASSWORD=$(generate_base64 24)
# KeyDB/Redis
KEYDB_PASSWORD=$(generate_base64 24)
# MinIO
MINIO_ACCESS_KEY=$(generate_base64 16 | tr -d '/' | cut -c1-16)
MINIO_SECRET_KEY=$(generate_base64 32 | tr -d '/')
# Directus
DIRECTUS_KEY=$(generate_secret 16)
DIRECTUS_SECRET=$(generate_base64 32 | tr -d '/')
ADMIN_PASSWORD=$(generate_base64 16 | tr -d '/')
# Orchestration API
API_SECRET_KEY=$(generate_secret 32)
WEBHOOK_SECRET=$(generate_secret 32)
# Frontend
SESSION_SECRET=$(generate_secret 32)

log_success "All secrets generated"

# Step 3: Get user inputs
log_step "STEP 3: Configuration"
echo ""

# Admin email
read -p "Admin email [admin@example.com]: " ADMIN_EMAIL_INPUT
ADMIN_EMAIL=${ADMIN_EMAIL_INPUT:-admin@example.com}

# ACME email for Let's Encrypt
if [ "$ENVIRONMENT" = "production" ]; then
    read -p "Email for Let's Encrypt SSL certificates [$ADMIN_EMAIL]: " ACME_EMAIL_INPUT
    ACME_EMAIL=${ACME_EMAIL_INPUT:-$ADMIN_EMAIL}
else
    ACME_EMAIL="admin@dejtoai.cz"
fi

# Gemini API key
echo ""
log_warning "Gemini API Key Required"
echo "You'll need a Gemini API key from https://aistudio.google.com/app/apikey"
read -p "Enter Gemini API key (or press Enter to skip): " GEMINI_API_KEY_INPUT
GEMINI_API_KEY=${GEMINI_API_KEY_INPUT:-your_gemini_api_key_here}

log_success "Configuration collected"

# Step 4: Create environment files
log_step "STEP 4: Create Environment Files"
echo ""

cd "$PROJECT_ROOT"

# Root .env
log_info "Creating root .env..."
cat > .env << EOF
# Office Automation - Root Environment Configuration
# Auto-generated on $(date)

# ============================================================================
# PROJECT CONFIGURATION
# ============================================================================

# ============================================================================
# TRAEFIK REVERSE PROXY
# ============================================================================
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL

# ============================================================================
# ENVIRONMENT
# ============================================================================
NODE_ENV=$NODE_ENV
EOF

log_success "Root .env created"

# Backend .env
log_info "Creating backend/.env..."
cat > backend/.env << EOF
# Backend Services - Environment Configuration
# Auto-generated on $(date)

# ============================================================================
# DATABASE (PostgreSQL)
# ============================================================================
POSTGRES_DB=directus
POSTGRES_USER=directus
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_PORT=5432

DB_DATABASE=\${POSTGRES_DB}
DB_USER=\${POSTGRES_USER}
DB_PASSWORD=\${POSTGRES_PASSWORD}

# ============================================================================
# CACHE (KeyDB/Redis)
# ============================================================================
KEYDB_PASSWORD=$KEYDB_PASSWORD
KEYDB_PORT=6379
REDIS_PASSWORD=\${KEYDB_PASSWORD}
REDIS_PORT=\${KEYDB_PORT}

CACHE_ENABLED=true
CACHE_STORE=redis
CACHE_NAMESPACE=directus_cache

# ============================================================================
# OBJECT STORAGE (MinIO)
# ============================================================================
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_BROWSER_REDIRECT_URL=http://localhost:9001
MINIO_BUCKET=office-automation

STORAGE_MINIO_KEY=\${MINIO_ACCESS_KEY}
STORAGE_MINIO_SECRET=\${MINIO_SECRET_KEY}
STORAGE_MINIO_BUCKET=\${MINIO_BUCKET}
STORAGE_MINIO_ENDPOINT=http://minio:9000

# ============================================================================
# DIRECTUS CMS
# ============================================================================
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

KEY=$DIRECTUS_KEY
SECRET=$DIRECTUS_SECRET

DIRECTUS_API_TOKEN=PLACEHOLDER_TOKEN_UPDATE_AFTER_SETUP
DIRECTUS_TOKEN=\${DIRECTUS_API_TOKEN}

# ============================================================================
# ORCHESTRATION API
# ============================================================================
ORCHESTRATION_PORT=3001
NODE_ENV=$NODE_ENV
LOG_LEVEL=info

API_SECRET_KEY=$API_SECRET_KEY
WEBHOOK_SECRET=$WEBHOOK_SECRET

CORS_ORIGIN=http://localhost:3000,http://localhost:4321,http://localhost:8055

GEMINI_API_KEY=$GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

# ============================================================================
# EMAIL (MailHog - Development Only)
# ============================================================================
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# ============================================================================
# DOCKER BUILD SETTINGS
# ============================================================================
DOCKER_BUILD_TARGET=$DOCKER_BUILD_TARGET
EOF

log_success "Backend .env created"

# Frontend .env
log_info "Creating frontend/.env..."
cat > frontend/.env << EOF
# Frontend - Environment Configuration
# Auto-generated on $(date)

# ============================================================================
# INTERNAL SERVICE URLS (Server-Side)
# ============================================================================
DIRECTUS_URL=http://directus:8055
ORCHESTRATION_API_URL=http://orchestration-api:3001

# ============================================================================
# PUBLIC URLS (Client-Side)
# ============================================================================
PUBLIC_DOMAIN=$DOMAIN
PUBLIC_DIRECTUS_URL=https://\${PUBLIC_DOMAIN}/admin
PUBLIC_API_URL=https://\${PUBLIC_DOMAIN}/api

# ============================================================================
# AUTHENTICATION
# ============================================================================
DIRECTUS_TOKEN=PLACEHOLDER_TOKEN_UPDATE_AFTER_SETUP
SESSION_SECRET=$SESSION_SECRET

# ============================================================================
# ENVIRONMENT
# ============================================================================
NODE_ENV=$NODE_ENV
PORT=4321
EOF

log_success "Frontend .env created"

# Step 5: Setup local domain (development only)
if [ "$ENVIRONMENT" = "development" ]; then
    log_step "STEP 5: Setup Local Domain"
    echo ""
    
    if grep -q "dev-dejtoai.local" /etc/hosts 2>/dev/null; then
        log_success "dev-dejtoai.local already configured in /etc/hosts"
    else
        log_info "Adding dev-dejtoai.local to /etc/hosts (requires sudo)..."
        echo ""
        echo "127.0.0.1 dev-dejtoai.local traefik.dev-dejtoai.local" | sudo tee -a /etc/hosts > /dev/null
        log_success "dev-dejtoai.local added to /etc/hosts"
    fi
fi

# Step 6: Start Docker services
log_step "STEP 6: Start Docker Services"
echo ""

log_info "Building and starting services..."
log_warning "This may take a few minutes on first run..."
echo ""

cd "$PROJECT_ROOT"

# Load environment variables and start services
set +e  # Don't exit on error for docker commands
if [ "$ENVIRONMENT" = "development" ]; then
    ./scripts/docker-start.sh up -d --build
else
    ./scripts/docker-start.sh up -d --build
fi
DOCKER_EXIT=$?
set -e

if [ $DOCKER_EXIT -ne 0 ]; then
    log_error "Docker services failed to start"
    log_info "Check logs with: docker compose logs"
    exit 1
fi

echo ""
log_success "Docker services started"

# Wait for services to be ready
log_info "Waiting for services to initialize (30s)..."
sleep 30

# Step 7: Import Directus schema
log_step "STEP 7: Import Directus Schema"
echo ""

log_info "Checking if Directus is ready..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose exec -T directus npx directus --version > /dev/null 2>&1; then
        log_success "Directus is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_info "Waiting for Directus... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Directus did not start in time"
    log_info "You can import the schema later with: make import-schema"
else
    log_info "Importing Directus schema..."
    cd "$PROJECT_ROOT/backend"
    
    # Check which schema file exists
    if [ -f "docker/directus/schema/directus11_schema_snapshot.json" ]; then
        SCHEMA_FILE="docker/directus/schema/directus11_schema_snapshot.json"
    elif [ -f "docker/directus/schema/directus11_schema_snapshot_simplified.json" ]; then
        SCHEMA_FILE="docker/directus/schema/directus11_schema_snapshot_simplified.json"
    else
        log_warning "No schema file found - skipping schema import"
        SCHEMA_FILE=""
    fi
    
    if [ -n "$SCHEMA_FILE" ]; then
        # Copy schema to container
        docker cp "$SCHEMA_FILE" directus:/directus/snapshots/import.json
        
        # Apply schema
        docker compose exec -T directus npx directus schema apply --yes /directus/snapshots/import.json
        
        # Cleanup
        docker compose exec -T directus rm -f /directus/snapshots/import.json
        
        log_success "Directus schema imported"
    fi
fi

# Step 8: Directus API Token Setup
log_step "STEP 8: Directus API Token Setup"
echo ""

echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  ACTION REQUIRED: Create Directus API Token           ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "To complete the setup, you need to create an API token in Directus:"
echo ""
echo -e "${BOLD}Steps:${NC}"
echo "  1. Open Directus in your browser"
echo "  2. Login with the admin credentials"
echo "  3. Go to Settings → Access Tokens"
echo "  4. Create a new token with Admin permissions"
echo "  5. Copy the token"
echo ""
echo -e "${BOLD}Access Details:${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    echo "  URL:      ${CYAN}http://localhost:8055${NC} or ${CYAN}http://$DOMAIN/admin${NC}"
else
    echo "  URL:      ${CYAN}https://$DOMAIN/admin${NC}"
fi
echo "  Email:    ${CYAN}$ADMIN_EMAIL${NC}"
echo "  Password: ${CYAN}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "${YELLOW}⚠  Save the admin password above - you'll need it!${NC}"
echo ""

read -p "Press Enter when you're ready to input the API token..."
echo ""

# Get token
read -p "Enter the Directus API token: " DIRECTUS_TOKEN_INPUT

if [ -z "$DIRECTUS_TOKEN_INPUT" ]; then
    log_warning "No token entered - you'll need to update it manually later"
    log_info "Update these files:"
    echo "  • backend/.env (DIRECTUS_API_TOKEN)"
    echo "  • frontend/.env (DIRECTUS_TOKEN)"
else
    # Update backend/.env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/DIRECTUS_API_TOKEN=.*/DIRECTUS_API_TOKEN=$DIRECTUS_TOKEN_INPUT/" backend/.env
        sed -i '' "s/DIRECTUS_TOKEN=.*/DIRECTUS_TOKEN=$DIRECTUS_TOKEN_INPUT/" frontend/.env
    else
        # Linux
        sed -i "s/DIRECTUS_API_TOKEN=.*/DIRECTUS_API_TOKEN=$DIRECTUS_TOKEN_INPUT/" backend/.env
        sed -i "s/DIRECTUS_TOKEN=.*/DIRECTUS_TOKEN=$DIRECTUS_TOKEN_INPUT/" frontend/.env
    fi
    
    log_success "API token updated in environment files"
fi

# Step 9: Rebuild services with token
if [ -n "$DIRECTUS_TOKEN_INPUT" ]; then
    log_step "STEP 9: Rebuild Services"
    echo ""
    
    log_info "Restarting services to apply API token..."
    cd "$PROJECT_ROOT"
    
    # Restart orchestration-api and frontend
    docker compose restart orchestration-api frontend
    
    log_success "Services restarted"
    
    # Wait a bit for services to restart
    log_info "Waiting for services to restart (10s)..."
    sleep 10
fi

# Step 10: Test setup
log_step "STEP 10: Test Setup"
echo ""

log_info "Testing service health..."

# Test each service
FAILED_SERVICES=()

# Test Traefik
if curl -sf http://localhost:80 > /dev/null 2>&1; then
    log_success "Traefik is running"
else
    log_error "Traefik is not responding"
    FAILED_SERVICES+=("Traefik")
fi

# Test Frontend
if curl -sf http://localhost:4321 > /dev/null 2>&1; then
    log_success "Frontend is running"
else
    log_warning "Frontend is not responding (may still be starting)"
fi

# Test Directus
if curl -sf http://localhost:8055/server/ping > /dev/null 2>&1; then
    log_success "Directus is running"
else
    log_error "Directus is not responding"
    FAILED_SERVICES+=("Directus")
fi

# Test Orchestration API
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    log_success "Orchestration API is running"
else
    log_warning "Orchestration API is not responding (may need API token)"
fi

# Final summary
echo ""
log_step "✨ Setup Complete!"
echo ""

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}${BOLD}All services are running successfully!${NC}"
else
    echo -e "${YELLOW}${BOLD}Some services need attention:${NC}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo "  • $service"
    done
    echo ""
    echo "Check logs with: make logs"
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Access Your Application${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ "$ENVIRONMENT" = "development" ]; then
    echo "  Frontend:           ${CYAN}http://localhost:4321${NC}"
    echo "  Directus Admin:     ${CYAN}http://localhost:8055${NC}"
    echo "  Orchestration API:  ${CYAN}http://localhost:3001${NC}"
    echo "  MinIO Console:      ${CYAN}http://localhost:9001${NC}"
    echo "  MailHog:            ${CYAN}http://localhost:8025${NC}"
    echo "  Traefik Dashboard:  ${CYAN}http://traefik.dev-dejtoai.local:8080${NC}"
    echo ""
    echo "  Via Domain:"
    echo "  Main Site:          ${CYAN}http://dev-dejtoai.local${NC}"
    echo "  Directus:           ${CYAN}http://dev-dejtoai.local/admin${NC}"
else
    echo "  Main Site:          ${CYAN}https://$DOMAIN${NC}"
    echo "  Directus Admin:     ${CYAN}https://$DOMAIN/admin${NC}"
    echo "  Traefik Dashboard:  ${CYAN}https://traefik.$DOMAIN${NC}"
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Credentials${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Directus Admin:"
echo "    Email:    ${CYAN}$ADMIN_EMAIL${NC}"
echo "    Password: ${CYAN}$ADMIN_PASSWORD${NC}"
echo ""
echo "  MinIO Console:"
echo "    Access:   ${CYAN}$MINIO_ACCESS_KEY${NC}"
echo "    Secret:   ${CYAN}$MINIO_SECRET_KEY${NC}"
echo ""
echo -e "${YELLOW}⚠  Save these credentials securely!${NC}"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Useful Commands${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  View logs:          ${CYAN}make logs${NC}"
echo "  Check status:       ${CYAN}make status${NC}"
echo "  Check health:       ${CYAN}make health${NC}"
echo "  Stop services:      ${CYAN}make down${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    echo "  Restart (dev):      ${CYAN}make start-dev${NC}"
else
    echo "  Restart (prod):     ${CYAN}make start-prod${NC}"
fi
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Next Steps${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Test the services: ${CYAN}make health${NC}"
echo "  2. Check the logs:    ${CYAN}make logs${NC}"
echo "  3. Start developing! 🚀"
echo ""
echo -e "${GREEN}✨ Happy coding!${NC}"
echo ""

