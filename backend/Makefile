# Directus Document Processing Backend
# Makefile for common development tasks

.PHONY: help start stop logs status import-schema quick-import clean backup

# Default target
help:
	@echo "Available commands:"
	@echo "  make start         - Start all services"
	@echo "  make stop          - Stop all services"
	@echo "  make logs          - View all service logs"
	@echo "  make status        - Check service status"
	@echo "  make import-schema - Import Directus schema (interactive)"
	@echo "  make quick-import  - Quick import schema (no prompts)"
	@echo "  make backup        - Backup current Directus schema"
	@echo "  make clean         - Remove all containers and volumes"

# Service management
start:
	@echo "🚀 Starting all services..."
	docker compose up -d

stop:
	@echo "🛑 Stopping all services..."
	docker compose down

restart: stop start

# Monitoring
logs:
	docker compose logs -f

status:
	@echo "📊 Service Status:"
	docker compose ps

# Schema management
import-schema:
	@echo "📋 Importing Directus schema (interactive)..."
	@./scripts/import-directus-schema.sh

quick-import:
	@echo "⚡ Quick importing Directus schema..."
	@./scripts/quick-import-schema.sh

backup:
	@echo "💾 Creating schema backup..."
	@CONTAINER_NAME="$${PROJECT_PREFIX:-office-automation_}-directus"; \
	BACKUP_FILE="backup-$$(date +%F_%H-%M-%S).json"; \
	docker exec "$$CONTAINER_NAME" npx directus schema snapshot "/directus/snapshots/$$BACKUP_FILE"; \
	echo "✅ Backup created: /directus/snapshots/$$BACKUP_FILE"

# Development
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@read -p "This will remove ALL containers and data. Continue? (y/N): " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		docker compose down -v --remove-orphans; \
		docker system prune -f; \
		echo "✅ Cleanup completed"; \
	else \
		echo "❌ Cleanup cancelled"; \
	fi

# Service-specific logs
logs-directus:
	docker compose logs -f directus

logs-temporal:
	docker compose logs -f temporal

logs-workers:
	docker compose logs -f worker-classify worker-llm-extract worker-validate worker-export worker-deliver worker-notifier

logs-orchestration:
	docker compose logs -f orchestration-api

logs-email:
	docker compose logs -f email-collector

# Health checks
health:
	@echo "🏥 Health Checks:"
	@echo "Directus:         $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8055/server/ping || echo 'DOWN')"
	@echo "Temporal UI:      $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8085 || echo 'DOWN')" 
	@echo "MinIO Console:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:9001 || echo 'DOWN')"
	@echo "Orchestration:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health || echo 'DOWN')"

# Development helpers
dev-setup: start import-schema
	@echo "🎯 Development environment ready!"
	@echo "📱 Directus Admin: http://localhost:8055"
	@echo "🔄 Temporal UI: http://localhost:8085"  
	@echo "💾 MinIO Console: http://localhost:9001"
	@echo "🎛️  Orchestration API: http://localhost:3001"

# Database access
db:
	@CONTAINER_NAME="$${PROJECT_PREFIX:-office-automation_}-postgres"; \
	docker exec -it "$$CONTAINER_NAME" psql -U directus -d directus

