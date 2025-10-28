# Office Automation - Makefile
# Convenient commands for managing the entire stack

.PHONY: help up down restart logs status build rebuild clean shell setup check-env setup-domain setup-dev setup-prod setup-env import-schema setup-directus-token start-dev start-prod dev-up dev-down dev-restart dev-logs prod-up prod-down rebuild-orchestration logs-orchestration

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
	@echo "  make dev-up      - Start dev environment with hot-reload (recommended)"
	@echo "  make prod-up     - Start prod environment (optimized builds)"
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

up: dev-up ## Start services (defaults to development with hot-reload)

down: ## Stop all services (detects which compose file is running)
	@echo "$(YELLOW)Stopping all services...$(NC)"
	@if docker compose -f docker-compose.dev.yml ps -q > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml down; \
	elif docker compose -f docker-compose.prod.yml ps -q > /dev/null 2>&1; then \
		docker compose -f docker-compose.prod.yml down; \
	else \
		docker compose down; \
	fi

restart: down dev-up ## Restart all services (defaults to development)

logs: ## View logs (detects which environment is running)
	@if docker compose -f docker-compose.dev.yml ps -q > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml logs -f; \
	elif docker compose -f docker-compose.prod.yml ps -q > /dev/null 2>&1; then \
		docker compose -f docker-compose.prod.yml logs -f; \
	else \
		docker compose logs -f; \
	fi

logs-traefik: ## View Traefik logs
	@docker compose logs -f traefik

logs-frontend: ## View frontend logs (detects environment)
	@if docker compose -f docker-compose.dev.yml ps -q frontend > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml logs -f frontend; \
	elif docker compose -f docker-compose.prod.yml ps -q frontend > /dev/null 2>&1; then \
		docker compose -f docker-compose.prod.yml logs -f frontend; \
	else \
		docker compose logs -f frontend; \
	fi

logs-directus: ## View Directus logs
	@docker compose logs -f directus

logs-api: ## View orchestration API logs (detects environment)
	@if docker compose -f docker-compose.dev.yml ps -q orchestration-api > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml logs -f orchestration-api; \
	elif docker compose -f docker-compose.prod.yml ps -q orchestration-api > /dev/null 2>&1; then \
		docker compose -f docker-compose.prod.yml logs -f orchestration-api; \
	else \
		docker compose logs -f orchestration-api; \
	fi

status: ## Show status of all services (detects environment)
	@if docker compose -f docker-compose.dev.yml ps > /dev/null 2>&1; then \
		echo "$(GREEN)Development Environment Status:$(NC)"; \
		docker compose -f docker-compose.dev.yml ps; \
	elif docker compose -f docker-compose.prod.yml ps > /dev/null 2>&1; then \
		echo "$(GREEN)Production Environment Status:$(NC)"; \
		docker compose -f docker-compose.prod.yml ps; \
	else \
		docker compose ps; \
	fi

build: check-env ## Build all services (detects environment)
	@echo "$(GREEN)Building all services...$(NC)"
	@if docker compose -f docker-compose.dev.yml ps > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml build; \
	elif docker compose -f docker-compose.prod.yml ps > /dev/null 2>&1; then \
		docker compose -f docker-compose.prod.yml build; \
	else \
		echo "$(YELLOW)No environment running. Use 'make dev-build' or 'make prod-build'$(NC)"; \
	fi

rebuild: check-env ## Rebuild all services without cache (detects environment)
	@echo "$(GREEN)Rebuilding all services (no cache)...$(NC)"
	@if docker compose -f docker-compose.dev.yml ps > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml build --no-cache; \
	elif docker compose -f docker-compose.prod.yml ps > /dev/null 2>&1; then \
		docker compose -f docker-compose.prod.yml build --no-cache; \
	else \
		echo "$(YELLOW)No environment running. Use 'make dev-build' or 'make prod-build'$(NC)"; \
	fi

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

setup: dev-up ## Alias for dev-up (default setup with hot-reload)

setup-dev: dev-up ## Alias for dev-up (development environment setup)

setup-prod: prod-up ## Alias for prod-up (production environment setup)

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

# ========================================
# Development Environment (Hot-Reload)
# ========================================

dev-up: check-env ## Start development environment with hot-reload
	@echo "$(GREEN)╔════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  Starting Development Environment (Hot-Reload)         ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Features:$(NC)"
	@echo "  • Frontend: Hot module reload (Astro)"
	@echo "  • Orchestration API: Hot module reload (tsx watch)"
	@echo "  • Source code mounted via volumes"
	@echo "  • MailHog for email testing"
	@echo ""
	@docker compose -f docker-compose.dev.yml up -d --build
	@echo ""
	@echo "$(GREEN)✓ Development environment started$(NC)"
	@echo ""
	@echo "$(CYAN)Access points:$(NC)"
	@echo "  • Main site: $(YELLOW)http://dev-dejtoai.local$(NC)"
	@echo "  • Directus: $(YELLOW)http://directus.dev-dejtoai.local$(NC)"
	@echo "  • MailHog: $(YELLOW)http://mailhog.dev-dejtoai.local$(NC)"
	@echo ""
	@docker compose -f docker-compose.dev.yml ps

dev-down: ## Stop development environment
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	@docker compose -f docker-compose.dev.yml down
	@echo "$(GREEN)✓ Development environment stopped$(NC)"

dev-restart: dev-down dev-up ## Restart development environment

dev-logs: ## View logs from development environment
	@docker compose -f docker-compose.dev.yml logs -f

dev-logs-frontend: ## View frontend logs (dev)
	@docker compose -f docker-compose.dev.yml logs -f frontend

dev-logs-api: ## View orchestration API logs (dev)
	@docker compose -f docker-compose.dev.yml logs -f orchestration-api

dev-build: check-env ## Rebuild development services
	@echo "$(GREEN)Rebuilding development services...$(NC)"
	@docker compose -f docker-compose.dev.yml build --no-cache
	@echo "$(GREEN)✓ Development services rebuilt$(NC)"

# ========================================
# Production Environment
# ========================================

prod-up: check-env ## Start production environment
	@echo "$(GREEN)╔════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  Starting Production Environment                       ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@docker compose -f docker-compose.prod.yml up -d --build
	@echo ""
	@echo "$(GREEN)✓ Production environment started$(NC)"
	@echo ""
	@docker compose -f docker-compose.prod.yml ps

prod-down: ## Stop production environment
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	@docker compose -f docker-compose.prod.yml down
	@echo "$(GREEN)✓ Production environment stopped$(NC)"

prod-logs: ## View logs from production environment
	@docker compose -f docker-compose.prod.yml logs -f

prod-build: check-env ## Rebuild production services
	@echo "$(GREEN)Rebuilding production services...$(NC)"
	@docker compose -f docker-compose.prod.yml build --no-cache
	@echo "$(GREEN)✓ Production services rebuilt$(NC)"
