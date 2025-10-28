#!/bin/bash

# Office Automation - Initial Setup Script
# This script helps you set up the environment for the first time

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Office Automation - Initial Setup                    ║"
echo "║   Root Environment (Traefik + Docker)                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "This script sets up the root environment for Traefik and Docker."
echo "Backend and frontend configs will be set up separately."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  Root .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

# Copy template
echo "📝 Creating root .env file from template..."
cp env.template .env

# Detect environment
echo ""
echo "🔧 Environment Configuration"
echo "----------------------------"
echo "1) Production (dejtoai.cz)"
echo "2) Development (dev-dejtoai.local)"
read -p "Select environment [1-2]: " ENV_CHOICE

case $ENV_CHOICE in
    1)
        DOMAIN="dejtoai.cz"
        NODE_ENV="production"
        echo -e "${GREEN}✓${NC} Production environment selected"
        ;;
    2)
        DOMAIN="dev-dejtoai.local"
        NODE_ENV="development"
        echo -e "${GREEN}✓${NC} Development environment selected"
        
        # Check /etc/hosts
        if ! grep -q "dev-dejtoai.local" /etc/hosts 2>/dev/null; then
            echo -e "${YELLOW}⚠️  dev-dejtoai.local not found in /etc/hosts${NC}"
            echo "Add this line to /etc/hosts:"
            echo "  127.0.0.1 dev-dejtoai.local traefik.dev-dejtoai.local"
        fi
        ;;
    *)
        echo -e "${RED}✗${NC} Invalid choice"
        exit 1
        ;;
esac

# Update .env with domain and environment
sed -i.bak "s/DOMAIN=.*/DOMAIN=$DOMAIN/" .env
sed -i.bak "s/NODE_ENV=.*/NODE_ENV=$NODE_ENV/" .env
rm .env.bak

# Get email for Let's Encrypt
echo ""
echo "📧 SSL Certificate Email"
echo "------------------------"
read -p "Enter email for Let's Encrypt certificates [$ACME_EMAIL]: " ACME_EMAIL_INPUT
ACME_EMAIL=${ACME_EMAIL_INPUT:-admin@dejtoai.cz}

if [ -n "$ACME_EMAIL" ]; then
    sed -i.bak "s/ACME_EMAIL=.*/ACME_EMAIL=$ACME_EMAIL/" .env
    rm .env.bak
    echo -e "${GREEN}✓${NC} Email configured: $ACME_EMAIL"
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Root Environment Setup Complete!                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Configuration Summary:"
echo "  • Environment: $NODE_ENV"
echo "  • Domain: $DOMAIN"
echo "  • Root config: .env"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  Configure Backend Services"
echo "   cd backend"
echo "   cp env.template .env"
echo "   nano .env  # Set passwords, API keys, etc."
echo ""
echo "2️⃣  Configure Frontend"
echo "   cd frontend"
echo "   cp env.template .env"
echo "   nano .env  # Set session secrets, URLs, etc."
echo ""
echo "3️⃣  Start All Services"
echo "   cd ..  # Back to root"
echo "   docker compose up -d"
echo ""
echo "4️⃣  Import Directus Schema (first time only)"
echo "   cd backend"
echo "   ./scripts/quick-import-schema.sh"
echo ""
echo "5️⃣  Access Your Application"
echo "   Frontend:  https://$DOMAIN"
echo "   Directus:  https://$DOMAIN/admin"
echo "   Traefik:   https://traefik.$DOMAIN"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📚 Documentation:"
echo "  • TRAEFIK_SETUP.md - Complete production setup guide"
echo "  • README.md - General documentation"
echo "  • backend/ENVIRONMENT.md - Backend configuration guide"
echo ""
echo -e "${GREEN}✨ Root setup complete! Configure backend & frontend next.${NC}"

