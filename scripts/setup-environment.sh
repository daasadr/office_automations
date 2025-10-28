#!/bin/bash

# Office Automation - Environment Setup
# Check environment files and start services

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

# Banner
clear
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                                        ║${NC}"
echo -e "${BOLD}║        Office Automation - Environment Setup          ║${NC}"
echo -e "${BOLD}║                                                        ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if environment files exist
log_step "STEP 1: Check Environment Files"
echo ""

cd "$PROJECT_ROOT"

MISSING_FILES=()

if [ ! -f ".env" ]; then
    log_error "Root .env file not found"
    MISSING_FILES+=(".env")
else
    log_success "Root .env file exists"
fi

if [ ! -f "backend/.env" ]; then
    log_error "backend/.env file not found"
    MISSING_FILES+=("backend/.env")
else
    log_success "backend/.env file exists"
fi

if [ ! -f "frontend/.env" ]; then
    log_error "frontend/.env file not found"
    MISSING_FILES+=("frontend/.env")
else
    log_success "frontend/.env file exists"
fi

# If any files are missing, exit with instructions
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}${BOLD}║  Environment Files Missing                             ║${NC}"
    echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}The following environment files must be prepared before setup:${NC}"
    echo ""
    for file in "${MISSING_FILES[@]}"; do
        echo "  ${RED}✗${NC} $file"
    done
    echo ""
    echo -e "${BOLD}How to prepare environment files:${NC}"
    echo ""
    echo "1. Copy the template files:"
    echo ""
    if [[ " ${MISSING_FILES[@]} " =~ " .env " ]]; then
        echo "   ${CYAN}cp env.template .env${NC}"
    fi
    if [[ " ${MISSING_FILES[@]} " =~ " backend/.env " ]]; then
        echo "   ${CYAN}cp backend/env.template backend/.env${NC}"
    fi
    if [[ " ${MISSING_FILES[@]} " =~ " frontend/.env " ]]; then
        echo "   ${CYAN}cp frontend/env.template frontend/.env${NC}"
    fi
    echo ""
    echo "2. Edit each file and configure the required values:"
    echo ""
    echo "   • Database passwords"
    echo "   • API keys (Gemini, etc.)"
    echo "   • Secrets and tokens"
    echo "   • Domain configuration"
    echo ""
    echo "3. Run setup again:"
    echo "   ${CYAN}make setup-dev${NC} or ${CYAN}make setup-prod${NC}"
    echo ""
    echo -e "${YELLOW}⚠  All environment files must exist before starting Docker services${NC}"
    echo ""
    exit 1
fi

log_success "All environment files are present"

# Step 2: Check if Docker is running
log_step "STEP 2: Check Docker Engine"
echo ""

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

# Step 3: Detect environment type from .env
log_step "STEP 3: Detect Environment Type"
echo ""

if [ -f ".env" ]; then
    # Try to detect environment from NODE_ENV in .env
    if grep -q "NODE_ENV=production" .env 2>/dev/null; then
        ENVIRONMENT="production"
        NODE_ENV="production"
    else
        ENVIRONMENT="development"
        NODE_ENV="development"
    fi
    
    # Try to get domain from .env
    DOMAIN=$(grep "^DOMAIN=" .env 2>/dev/null | cut -d '=' -f2 || echo "dev-dejtoai.local")
    
    log_success "Environment detected: $ENVIRONMENT"
    log_info "Domain: $DOMAIN"
else
    log_warning "Could not detect environment, defaulting to development"
    ENVIRONMENT="development"
    DOMAIN="dev-dejtoai.local"
fi

# Step 4: Setup local domain (development only)
if [ "$ENVIRONMENT" = "development" ]; then
    log_step "STEP 4: Setup Local Domain"
    echo ""
    
    if grep -q "dev-dejtoai.local" /etc/hosts 2>/dev/null; then
        log_success "dev-dejtoai.local already configured in /etc/hosts"
    else
        log_info "Adding dev-dejtoai.local to /etc/hosts (requires sudo)..."
        echo ""
        echo "127.0.0.1 dev-dejtoai.local directus.dev-dejtoai.local api.dev-dejtoai.local minio.dev-dejtoai.local mailhog.dev-dejtoai.local traefik.dev-dejtoai.local" | sudo tee -a /etc/hosts > /dev/null
        log_success "dev-dejtoai.local and subdomains added to /etc/hosts"
    fi
fi

# Step 5: Start Docker services
log_step "STEP 5: Start Docker Services"
echo ""

log_info "Building and starting services..."
log_warning "This may take a few minutes on first run..."
echo ""

cd "$PROJECT_ROOT"

# Load environment variables and start services
set +e  # Don't exit on error for docker commands
./scripts/docker-start.sh up -d --build
DOCKER_EXIT=$?
set -e

if [ $DOCKER_EXIT -ne 0 ]; then
    echo ""
    log_warning "Initial startup encountered some issues (this is normal for first run)"
    log_info "Some services like KeyDB may need extra time to become healthy..."
    echo ""
    
    # Check if KeyDB container exists and is running (even if unhealthy)
    if docker compose ps keydb | grep -q "running"; then
        log_info "KeyDB is running but healthcheck hasn't passed yet"
        log_info "Waiting for services to stabilize (30 seconds)..."
        sleep 30
    else
        log_info "Waiting 15 seconds before retry..."
        sleep 15
    fi
    
    # Try again without --build (since build already succeeded)
    set +e
    log_info "Retrying startup..."
    ./scripts/docker-start.sh up -d
    DOCKER_EXIT=$?
    set -e
    
    if [ $DOCKER_EXIT -ne 0 ]; then
        echo ""
        # Check if KeyDB is now running even if unhealthy
        if docker compose ps keydb | grep -q "running"; then
            log_warning "Services are running but some healthchecks haven't passed yet"
            log_info "This is normal - healthchecks can take up to 60 seconds"
            echo ""
            log_info "Waiting additional 30 seconds for healthchecks..."
            sleep 30
            
            # One final attempt
            set +e
            ./scripts/docker-start.sh up -d
            DOCKER_EXIT=$?
            set -e
            
            # If still failing but services are running, consider it a success
            if [ $DOCKER_EXIT -ne 0 ]; then
                if docker compose ps | grep -q "running"; then
                    log_warning "Services are running but healthchecks are still pending"
                    log_info "Continuing with setup - services should become healthy soon"
                    DOCKER_EXIT=0
                fi
            fi
        fi
        
        # If still failing, show troubleshooting
        if [ $DOCKER_EXIT -ne 0 ]; then
            echo ""
            log_error "Docker services failed to start after multiple retries"
            log_info "This can happen if services need more time to initialize"
            echo ""
            echo "Try one of these solutions:"
            echo ""
            echo "1. Check service status:"
            echo "   ${CYAN}docker compose ps${NC}"
            echo ""
            echo "2. Check logs for errors:"
            echo "   ${CYAN}docker compose logs keydb${NC}"
            echo "   ${CYAN}docker compose logs directus${NC}"
            echo ""
            echo "3. Wait and retry manually (recommended):"
            echo "   ${CYAN}docker compose up -d${NC}"
            echo ""
            echo "4. If problems persist, stop and start fresh:"
            echo "   ${CYAN}docker compose down${NC}"
            echo "   ${CYAN}docker compose up -d${NC}"
            echo ""
            exit 1
        fi
    fi
fi

echo ""
log_success "Docker services started"

# Wait for services to be ready
log_info "Waiting for services to initialize (30s)..."
sleep 30

# Step 6: Check if schema import is needed
log_step "STEP 6: Directus Schema (Optional)"
echo ""

echo "Would you like to import the Directus schema now?"
echo "(You can also do this later with: ${CYAN}make import-schema${NC})"
echo ""
read -p "Import schema? [y/N]: " IMPORT_SCHEMA

if [[ "$IMPORT_SCHEMA" =~ ^[Yy]$ ]]; then
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
        
        # Use only the simplified schema file
        if [ -f "docker/directus/schema/directus11_schema_snapshot_simplified.json" ]; then
            SCHEMA_FILE="docker/directus/schema/directus11_schema_snapshot_simplified.json"
        else
            log_warning "Simplified schema file not found - skipping schema import"
            SCHEMA_FILE=""
        fi
        
        if [ -n "$SCHEMA_FILE" ]; then
            # Create snapshots directory in container using docker exec
            log_info "Creating snapshots directory..."
            docker exec directus mkdir -p /directus/snapshots 2>/dev/null || true
            
            # Verify directory exists
            if ! docker exec directus test -d /directus/snapshots; then
                log_warning "Failed to create snapshots directory, trying alternative approach..."
                # Copy to /tmp first, then move
                docker cp "$SCHEMA_FILE" directus:/tmp/schema_import.json
                docker exec directus sh -c "mkdir -p /directus/snapshots && mv /tmp/schema_import.json /directus/snapshots/import.json"
            else
                # Copy schema to container
                log_info "Copying schema file to container..."
                docker cp "$SCHEMA_FILE" directus:/directus/snapshots/import.json
            fi
            
            # Apply schema
            log_info "Applying schema..."
            docker exec directus npx directus schema apply --yes /directus/snapshots/import.json
            
            # Cleanup
            docker exec directus rm -f /directus/snapshots/import.json 2>/dev/null || true
            
            log_success "Directus schema imported"
        fi
        
        cd "$PROJECT_ROOT"
    fi
else
    log_info "Schema import skipped"
    log_info "You can import later with: ${CYAN}make import-schema${NC}"
fi

# Step 7: Setup Directus Access Token
log_step "STEP 7: Setup Directus Access Token"
echo ""

echo -e "${BOLD}Directus requires an API token to enable the Orchestration API and Frontend.${NC}"
echo ""
echo -e "${YELLOW}⚠  Follow these steps to create an access token:${NC}"
echo ""
echo -e "  ${BOLD}1.${NC} Open Directus Admin Panel:"
if [ "$ENVIRONMENT" = "development" ]; then
    echo -e "     ${CYAN}http://directus.dev-dejtoai.local/${NC}"
else
    echo -e "     ${CYAN}https://$DOMAIN/admin${NC}"
fi
echo ""
echo -e "  ${BOLD}2.${NC} Login with admin credentials from ${CYAN}backend/.env${NC}:"
echo -e "     • Username: \$DIRECTUS_ADMIN_EMAIL"
echo -e "     • Password: \$DIRECTUS_ADMIN_PASSWORD"
echo ""
echo -e "  ${BOLD}3.${NC} Navigate to: ${CYAN}Settings → Access Tokens${NC}"
echo ""
echo -e "  ${BOLD}4.${NC} Click ${CYAN}\"Create Token\"${NC} and configure:"
echo -e "     • Name: ${CYAN}\"API Access Token\"${NC} (or any name)"
echo -e "     • Set appropriate permissions for your use case"
echo -e "     • Click ${CYAN}\"Save\"${NC}"
echo ""
echo -e "  ${BOLD}5.${NC} Copy the generated token (you won't see it again!)"
echo ""
echo -e "  ${BOLD}6.${NC} ${YELLOW}Optional but recommended:${NC} Set up public access policies:"
echo -e "     • Go to ${CYAN}Settings → Roles & Permissions${NC}"
echo -e "     • Select or create a ${CYAN}\"Public\"${NC} role"
echo -e "     • Configure access permissions for public endpoints"
echo -e "     • Edit policies to allow specific operations"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
read -p "Have you created a Directus access token? [y/N]: " HAS_TOKEN

if [[ "$HAS_TOKEN" =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Enter your Directus access token: " DIRECTUS_TOKEN
    
    if [ -n "$DIRECTUS_TOKEN" ]; then
        log_info "Updating environment files with access token..."
        
        # Update root .env
        if [ -f ".env" ]; then
            if grep -q "^DIRECTUS_API_TOKEN=" .env; then
                # Update existing token
                sed -i.bak "s|^DIRECTUS_API_TOKEN=.*|DIRECTUS_API_TOKEN=$DIRECTUS_TOKEN|" .env && rm .env.bak
                log_success "Updated DIRECTUS_API_TOKEN in .env"
            else
                # Add new token
                echo "" >> .env
                echo "DIRECTUS_API_TOKEN=$DIRECTUS_TOKEN" >> .env
                log_success "Added DIRECTUS_API_TOKEN to .env"
            fi
        fi
        
        # Update backend/.env
        if [ -f "backend/.env" ]; then
            if grep -q "^DIRECTUS_API_TOKEN=" backend/.env; then
                # Update existing token
                sed -i.bak "s|^DIRECTUS_API_TOKEN=.*|DIRECTUS_API_TOKEN=$DIRECTUS_TOKEN|" backend/.env && rm backend/.env.bak
                log_success "Updated DIRECTUS_API_TOKEN in backend/.env"
            else
                # Add new token
                echo "" >> backend/.env
                echo "DIRECTUS_API_TOKEN=$DIRECTUS_TOKEN" >> backend/.env
                log_success "Added DIRECTUS_API_TOKEN to backend/.env"
            fi
        fi
        
        # Update frontend/.env
        if [ -f "frontend/.env" ]; then
            if grep -q "^DIRECTUS_TOKEN=" frontend/.env; then
                # Update existing token
                sed -i.bak "s|^DIRECTUS_TOKEN=.*|DIRECTUS_TOKEN=$DIRECTUS_TOKEN|" frontend/.env && rm frontend/.env.bak
                log_success "Updated DIRECTUS_TOKEN in frontend/.env"
            else
                # Add new token
                echo "" >> frontend/.env
                echo "DIRECTUS_TOKEN=$DIRECTUS_TOKEN" >> frontend/.env
                log_success "Added DIRECTUS_TOKEN to frontend/.env"
            fi
        fi
        
        # Restart services to apply the new token
        log_info "Restarting affected services..."
        docker compose restart orchestration-api frontend > /dev/null 2>&1 || log_warning "Could not restart services automatically"
        
        log_success "Directus access token configured!"
        echo ""
        log_info "Services restarted to apply the new token"
    else
        log_warning "No token entered - skipping token setup"
        log_info "You can set it up later with: ${CYAN}make setup-directus-token${NC}"
    fi
else
    log_warning "Token setup skipped"
    echo ""
    echo -e "${YELLOW}⚠  Important: Without an API token, the Orchestration API and Frontend may not work properly.${NC}"
    echo ""
    echo -e "You can set up the token later by:"
    echo -e "  1. Creating the token in Directus (follow steps above)"
    echo -e "  2. Manually updating ${CYAN}backend/.env${NC} and ${CYAN}frontend/.env${NC}"
    echo -e "  3. Or run: ${CYAN}make setup-directus-token${NC}"
    echo ""
fi

# Step 8: Test setup
log_step "STEP 8: Test Key Services"
echo ""

log_info "Testing key service health..."

# Test key services only
FAILED_SERVICES=()

# Test Frontend
if curl -sf http://dev-dejtoai.local > /dev/null 2>&1; then
    log_success "Frontend is running"
else
    log_warning "Frontend is not responding (may still be starting)"
fi

# Test Directus
if curl -sf http://directus.dev-dejtoai.local/server/ping > /dev/null 2>&1; then
    log_success "Directus is running"
else
    log_error "Directus is not responding"
    FAILED_SERVICES+=("Directus")
fi

# Final summary
echo ""
log_step "✨ Setup Complete!"
echo ""

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}${BOLD}Key services are running successfully!${NC}"
else
    echo -e "${YELLOW}${BOLD}Some services need attention:${NC}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo "  • $service"
    done
    echo ""
    echo -e "Check logs with: ${CYAN}make logs${NC}"
fi
echo ""
log_info "To check all services health, run: ${CYAN}make health${NC}"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Access Your Application${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ "$ENVIRONMENT" = "development" ]; then
    echo -e "  Main Site:          ${CYAN}http://dev-dejtoai.local${NC}"
    echo -e "  Directus Admin:     ${CYAN}http://directus.dev-dejtoai.local/${NC}"
    echo -e "  Orchestration API:  ${CYAN}http://api.dev-dejtoai.local${NC}"
    echo -e "  MinIO Console:      ${CYAN}http://minio.dev-dejtoai.local${NC}"
    echo -e "  MailHog:            ${CYAN}http://mailhog.dev-dejtoai.local${NC}"
    echo -e "  Traefik Dashboard:  ${CYAN}http://traefik.dev-dejtoai.local${NC}"
else
    echo -e "  Main Site:          ${CYAN}https://$DOMAIN${NC}"
    echo -e "  Directus Admin:     ${CYAN}https://$DOMAIN/admin${NC}"
    echo -e "  Traefik Dashboard:  ${CYAN}https://traefik.$DOMAIN${NC}"
fi

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Useful Commands${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  View logs:          ${CYAN}make logs${NC}"
echo -e "  Check status:       ${CYAN}make status${NC}"
echo -e "  Check health:       ${CYAN}make health${NC}"
echo -e "  Stop services:      ${CYAN}make down${NC}"
echo -e "  Setup API token:    ${CYAN}make setup-directus-token${NC}"
if [ "$ENVIRONMENT" = "development" ]; then
    echo -e "  Restart (dev):      ${CYAN}make start-dev${NC}"
else
    echo -e "  Restart (prod):     ${CYAN}make start-prod${NC}"
fi
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Important: Foundation Document${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}⚠  For the application to function properly, you must upload a${NC}"
echo -e "${YELLOW}   Foundation Document for augmentation.${NC}"
echo ""
echo -e "${BOLD}Steps:${NC}"
echo -e "  1. Access the application frontend"
if [ "$ENVIRONMENT" = "development" ]; then
    echo -e "     ${CYAN}http://dev-dejtoai.local${NC}"
else
    echo -e "     ${CYAN}https://$DOMAIN${NC}"
fi
echo ""
echo -e "  2. Navigate to the document upload section"
echo ""
echo -e "  3. Upload your Foundation Document"
echo -e "     • This document is required for data augmentation"
echo -e "     • Without it, the application won't process documents correctly"
echo ""

echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Next Steps${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
if [[ ! "$HAS_TOKEN" =~ ^[Yy]$ ]] || [ -z "$DIRECTUS_TOKEN" ]; then
    echo -e "  1. ${YELLOW}Set up Directus API token:${NC} ${CYAN}make setup-directus-token${NC}"
    echo -e "  2. ${YELLOW}Upload Foundation Document${NC} (see instructions above)"
    echo -e "  3. Test the services: ${CYAN}make health${NC}"
    echo -e "  4. Check the logs:    ${CYAN}make logs${NC}"
    echo -e "  5. Start developing! 🚀"
else
    echo -e "  1. ${YELLOW}Upload Foundation Document${NC} (see instructions above)"
    echo -e "  2. Test the services: ${CYAN}make health${NC}"
    echo -e "  3. Check the logs:    ${CYAN}make logs${NC}"
    echo -e "  4. Start developing! 🚀"
fi
echo ""
echo -e "${GREEN}✨ Happy coding!${NC}"
echo ""

