# Office Automation - Makefile
# Convenient commands for managing the entire stack

.PHONY: help up down restart logs status build rebuild clean shell setup check-env setup-domain setup-dev setup-prod setup-env import-schema setup-directus-token start-dev start-prod rebuild-orchestration logs-orchestration

# Default target
.DEFAULT_GOAL := help

# Colors
YELLOW := \033[1;33m
GREEN := \033[0;32m
RED := \033[0;31m
CYAN := \033[0;36m
NC := \033[0m

help: ## Show this help message
	@echo ""
	@echo "$(GREEN)Office Automation - Management Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  make setup-env   - Copy environment templates (first time)"
	@echo "  make setup-dev   - Start dev environment (after env files ready)"
	@echo "  make setup-prod  - Start prod environment (after env files ready)"
	@echo ""
	@echo "$(YELLOW)Available Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

check-env: ## Check if all environment files exist
	@echo "$(YELLOW)Checking environment files...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(RED)✗ Root .env not found. Run: make setup-env$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f backend/.env ]; then \
		echo "$(RED)✗ backend/.env not found. Run: make setup-env$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f frontend/.env ]; then \
		echo "$(RED)✗ frontend/.env not found. Run: make setup-env$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✓ All environment files found$(NC)"

up: check-env ## Start all services
	@echo "$(GREEN)Starting all services...$(NC)"
	@./scripts/docker-start.sh up -d

down: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	@docker compose down

restart: down up ## Restart all services

logs: ## View logs (all services)
	@docker compose logs -f

logs-traefik: ## View Traefik logs
	@docker compose logs -f traefik

logs-frontend: ## View frontend logs
	@docker compose logs -f frontend

logs-directus: ## View Directus logs
	@docker compose logs -f directus

logs-api: ## View orchestration API logs
	@docker compose logs -f orchestration-api

status: ## Show status of all services
	@docker compose ps

build: check-env ## Build all services
	@echo "$(GREEN)Building all services...$(NC)"
	@./docker-start.sh build

rebuild: check-env ## Rebuild all services without cache
	@echo "$(GREEN)Rebuilding all services (no cache)...$(NC)"
	@./docker-start.sh build --no-cache

clean: ## Stop and remove all containers, volumes, and networks
	@echo "$(RED)⚠️  This will remove all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v; \
		echo "$(GREEN)✓ Cleaned up$(NC)"; \
	else \
		echo "Cancelled"; \
	fi

shell-frontend: ## Access frontend container shell
	@docker compose exec frontend sh

shell-api: ## Access orchestration API container shell
	@docker compose exec orchestration-api sh

shell-directus: ## Access Directus container shell
	@docker compose exec directus sh

shell-postgres: ## Access PostgreSQL container shell
	@docker compose exec postgres psql -U directus directus

setup: setup-dev ## Alias for setup-dev (default setup)

setup-dev: ## Check env files and start development environment
	@echo "$(GREEN)╔════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  Development Environment Setup                         ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@./scripts/setup-environment.sh

setup-prod: ## Check env files and start production environment
	@echo "$(GREEN)╔════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  Production Environment Setup                          ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@./scripts/setup-environment.sh

setup-env: ## Copy environment templates (first time setup)
	@echo "$(YELLOW)Generating environment files from templates...$(NC)"
	@if [ ! -f .env ]; then cp env.template .env; echo "$(GREEN)✓$(NC) Created root .env"; fi
	@if [ ! -f backend/.env ]; then cp backend/env.template backend/.env; echo "$(GREEN)✓$(NC) Created backend/.env"; fi
	@if [ ! -f frontend/.env ]; then cp frontend/env.template frontend/.env; echo "$(GREEN)✓$(NC) Created frontend/.env"; fi
	@echo ""
	@echo "$(YELLOW)⚠  IMPORTANT: Configure these files before starting services:$(NC)"
	@echo "  • .env"
	@echo "  • backend/.env"
	@echo "  • frontend/.env"
	@echo ""
	@echo "$(YELLOW)After configuring, run:$(NC)"
	@echo "  $(CYAN)make setup-dev$(NC)  or  $(CYAN)make setup-prod$(NC)"

setup-domain: ## Add dev-dejtoai.local to /etc/hosts
	@echo "$(YELLOW)Setting up local domain...$(NC)"
	@if grep -q "dev-dejtoai.local" /etc/hosts; then \
		echo "$(GREEN)✓ dev-dejtoai.local already configured$(NC)"; \
	else \
		echo "$(YELLOW)Adding dev-dejtoai.local to /etc/hosts (requires sudo)...$(NC)"; \
		echo "127.0.0.1 dev-dejtoai.local directus.dev-dejtoai.local api.dev-dejtoai.local minio.dev-dejtoai.local mailhog.dev-dejtoai.local traefik.dev-dejtoai.local" | sudo tee -a /etc/hosts > /dev/null; \
		echo "$(GREEN)✓ dev-dejtoai.local and subdomains added to /etc/hosts$(NC)"; \
	fi
	@echo ""
	@echo "$(GREEN)You can now access:$(NC)"
	@echo "  • Main site: http://dev-dejtoai.local"
	@echo "  • Directus: http://directus.dev-dejtoai.local"

pull: ## Pull latest images
	@docker compose pull

update: pull rebuild ## Update to latest versions

backup: ## Backup PostgreSQL database
	@echo "$(YELLOW)Backing up database...$(NC)"
	@docker compose exec postgres pg_dump -U directus directus > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up$(NC)"

import-schema: ## Import Directus schema
	@echo "$(YELLOW)Importing Directus schema...$(NC)"
	@if [ ! -f backend/docker/directus/schema/directus11_schema_snapshot.json ] && [ ! -f backend/docker/directus/schema/directus11_schema_snapshot_simplified.json ]; then \
		echo "$(RED)✗ Schema file not found$(NC)"; \
		exit 1; \
	fi
	@cd backend && ./scripts/quick-import-schema.sh
	@echo "$(GREEN)✓ Schema imported$(NC)"

setup-directus-token: ## Interactive guide to setup Directus API token
	@echo "$(YELLOW)╔════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(YELLOW)║  Directus API Token Setup                              ║$(NC)"
	@echo "$(YELLOW)╚════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "Follow these steps to create an API token:"
	@echo ""
	@echo "1. Open Directus: $(CYAN)http://directus.dev-dejtoai.local$(NC)"
	@echo "2. Login with your admin credentials"
	@echo "3. Go to Settings → Access Tokens"
	@echo "4. Create a new token with Admin permissions"
	@echo "5. Copy the token"
	@echo ""
	@read -p "Press Enter when ready to input the token..."
	@echo ""
	@read -p "Enter the Directus API token: " token; \
	if [ -n "$$token" ]; then \
		if [[ "$$OSTYPE" == "darwin"* ]]; then \
			sed -i '' "s/DIRECTUS_API_TOKEN=.*/DIRECTUS_API_TOKEN=$$token/" .env; \
			sed -i '' "s/DIRECTUS_API_TOKEN=.*/DIRECTUS_API_TOKEN=$$token/" backend/.env; \
			sed -i '' "s/DIRECTUS_TOKEN=.*/DIRECTUS_TOKEN=$$token/" frontend/.env; \
		else \
			sed -i "s/DIRECTUS_API_TOKEN=.*/DIRECTUS_API_TOKEN=$$token/" .env; \
			sed -i "s/DIRECTUS_API_TOKEN=.*/DIRECTUS_API_TOKEN=$$token/" backend/.env; \
			sed -i "s/DIRECTUS_TOKEN=.*/DIRECTUS_TOKEN=$$token/" frontend/.env; \
		fi; \
		echo ""; \
		echo "$(GREEN)✓ Token updated in all environment files$(NC)"; \
		echo ""; \
		echo "Restart services to apply:"; \
		echo "  $(CYAN)docker compose restart orchestration-api frontend$(NC)"; \
	else \
		echo "$(RED)✗ No token entered$(NC)"; \
	fi


start-dev: check-env ## Start in development mode (hot-reloading)
	@echo "$(GREEN)Starting in development mode...$(NC)"
	@echo "$(YELLOW)ℹ Using hot-reloading for orchestration-api$(NC)"
	@DOCKER_BUILD_TARGET=development ./scripts/docker-start.sh up -d
	@echo ""
	@echo "$(GREEN)✓ Services started in development mode$(NC)"
	@echo ""
	@make status

start-prod: check-env ## Start in production mode (optimized)
	@echo "$(GREEN)Starting in production mode...$(NC)"
	@echo "$(YELLOW)ℹ Using optimized builds$(NC)"
	@DOCKER_BUILD_TARGET=production ./scripts/docker-start.sh up -d
	@echo ""
	@echo "$(GREEN)✓ Services started in production mode$(NC)"
	@echo ""
	@make status

rebuild-orchestration: ## Rebuild orchestration-api (after dependency changes)
	@echo "$(YELLOW)Rebuilding orchestration-api...$(NC)"
	@docker compose build --no-cache orchestration-api
	@docker compose up -d orchestration-api
	@echo "$(GREEN)✓ Orchestration API rebuilt$(NC)"

logs-orchestration: ## View orchestration API logs
	@docker compose logs -f orchestration-api
