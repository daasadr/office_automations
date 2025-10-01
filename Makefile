# Office Automations Project
# Makefile for common development tasks

.PHONY: help start stop logs status import-schema quick-import clean backup dev-setup health db
.PHONY: frontend-dev frontend-build frontend-preview frontend-check frontend-install
.PHONY: lint format check install-deps

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "🏗️  Backend Services:"
	@echo "  make start         - Start all backend services"
	@echo "  make stop          - Stop all backend services"
	@echo "  make restart       - Restart all backend services"
	@echo "  make logs          - View all service logs"
	@echo "  make status        - Check service status"
	@echo "  make health        - Run health checks"
	@echo "  make clean         - Remove all containers and volumes"
	@echo ""
	@echo "📋 Schema Management:"
	@echo "  make import-schema - Import Directus schema (interactive)"
	@echo "  make quick-import  - Quick import schema (no prompts)"
	@echo "  make backup        - Backup current Directus schema"
	@echo ""
	@echo "🎨 Frontend Development:"
	@echo "  make frontend-dev     - Start frontend development server"
	@echo "  make frontend-build   - Build frontend for production"
	@echo "  make frontend-preview - Preview production build"
	@echo "  make frontend-check   - Run Astro type checking"
	@echo "  make frontend-install - Install frontend dependencies"
	@echo ""
	@echo "🔧 Development Tools:"
	@echo "  make lint          - Run linting on all code"
	@echo "  make format        - Format all code"
	@echo "  make check         - Run all checks and fixes"
	@echo "  make install-deps  - Install all project dependencies"
	@echo "  make dev-setup     - Complete development environment setup"
	@echo ""
	@echo "🗄️  Database:"
	@echo "  make db            - Connect to PostgreSQL database"

# Backend Service management
start:
	@echo "🚀 Starting all backend services..."
	cd backend && docker compose up -d

stop:
	@echo "🛑 Stopping all backend services..."
	cd backend && docker compose down

restart: stop start

# Monitoring
logs:
	cd backend && docker compose logs -f

status:
	@echo "📊 Service Status:"
	cd backend && docker compose ps

# Schema management
import-schema:
	@echo "📋 Importing Directus schema (interactive)..."
	@cd backend && ./scripts/import-directus-schema.sh

quick-import:
	@echo "⚡ Quick importing Directus schema..."
	@cd backend && ./scripts/quick-import-schema.sh

backup:
	@echo "💾 Creating schema backup..."
	@cd backend && CONTAINER_NAME="$${PROJECT_PREFIX:-office-automation_}-directus"; \
	BACKUP_FILE="backup-$$(date +%F_%H-%M-%S).json"; \
	docker exec "$$CONTAINER_NAME" npx directus schema snapshot "/directus/snapshots/$$BACKUP_FILE"; \
	echo "✅ Backup created: /directus/snapshots/$$BACKUP_FILE"

# Development
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@read -p "This will remove ALL containers and data. Continue? (y/N): " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		cd backend && docker compose down -v --remove-orphans; \
		docker system prune -f; \
		echo "✅ Cleanup completed"; \
	else \
		echo "❌ Cleanup cancelled"; \
	fi

# Service-specific logs
logs-directus:
	cd backend && docker compose logs -f directus

logs-temporal:
	cd backend && docker compose logs -f temporal

logs-workers:
	cd backend && docker compose logs -f worker-classify worker-llm-extract worker-validate worker-export worker-deliver worker-notifier

logs-orchestration:
	cd backend && docker compose logs -f orchestration-api

logs-email:
	cd backend && docker compose logs -f email-collector

# Health checks
health:
	@echo "🏥 Health Checks:"
	@echo "Directus:         $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8055/server/ping || echo 'DOWN')"
	@echo "Temporal UI:      $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8085 || echo 'DOWN')" 
	@echo "MinIO Console:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:9001 || echo 'DOWN')"
	@echo "Orchestration:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health || echo 'DOWN')"

# Frontend Development
frontend-dev:
	@echo "🎨 Starting frontend development server..."
	cd frontend && npm run dev

frontend-build:
	@echo "🏗️  Building frontend for production..."
	cd frontend && npm run build

frontend-preview:
	@echo "👀 Starting frontend preview server..."
	cd frontend && npm run preview

frontend-check:
	@echo "🔍 Running Astro type checking..."
	cd frontend && npm run check

frontend-install:
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install

# Development Tools
lint:
	@echo "🔍 Running linting..."
	npm run lint

format:
	@echo "✨ Formatting code..."
	npm run format:fix

check:
	@echo "🔧 Running all checks and fixes..."
	npm run check:fix

install-deps:
	@echo "📦 Installing all project dependencies..."
	npm install
	cd frontend && npm install
	cd backend/orchestration-api && npm install

# Complete development setup
dev-setup: install-deps start import-schema frontend-install
	@echo "🎯 Development environment ready!"
	@echo ""
	@echo "🔗 Available Services:"
	@echo "📱 Directus Admin:     http://localhost:8055"
	@echo "🔄 Temporal UI:        http://localhost:8085"  
	@echo "💾 MinIO Console:      http://localhost:9001"
	@echo "🎛️  Orchestration API:  http://localhost:3001"
	@echo ""
	@echo "🎨 Frontend Development:"
	@echo "Run 'make frontend-dev' to start the frontend development server"

# Database access
db:
	@CONTAINER_NAME="$${PROJECT_PREFIX:-office-automation_}-postgres"; \
	cd backend && docker exec -it "$$CONTAINER_NAME" psql -U directus -d directus
