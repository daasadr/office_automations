# Document Processing Backend

A comprehensive document processing system built with Directus CMS, Temporal workflows, and microservices architecture for automated document ingestion, classification, extraction, and delivery.

## Architecture Overview

The system follows a microservices architecture with the following components:

### Core Components

- **Directus CMS** - Content management and API layer
- **Temporal Server** - Workflow orchestration engine
- **PostgreSQL** - Primary database
- **MinIO** - S3-compatible object storage
- **KeyDB** - Redis-compatible cache

### Processing Services

- **Orchestration API** - Webhook handler and workflow starter
- **Email Collector** - IMAP/Gmail/Graph API email processing
- **Worker Services** - Document processing activities:
  - Classify/Parse/OCR Worker
  - LLM Extract Worker
  - Validate/Enrich Worker
  - Export CSV Worker
  - Deliver/Integrations Worker
  - Notifier Worker

### Project Structure

```
/docker - Docker service configurations
  /directus - Directus CMS service
  /temporal - Temporal server and UI
  /orchestration - Orchestration API service
  /workers - Worker service configurations
  /email-collector - Email collector service
  /keydb - KeyDB (Redis-compatible) cache
  /minio - MinIO S3-compatible storage
  /postgres - PostgreSQL database
/orchestration-api - Webhook API and workflow management
/workers - Temporal worker implementations
/email-collector - Email processing service
/extensions - Custom Directus extensions
/schema - Database schemas
docker-compose.yml - Complete stack configuration
ENVIRONMENT.md - Environment variables documentation
```

### Local Development Setup

#### Prerequisites
Before running the project locally, ensure that:
- Docker and Docker Compose are installed
- Required ports are available (check `docker-compose.yml` for specific ports)
- No conflicting Docker networks or volumes exist
- Container names are unique across your Docker environment

## Document Processing Workflow

The system implements the following workflow for document processing:

1. **Document Ingestion**
   - Upload via Astro Web App → Directus
   - Email attachments → Email Collector
   - Files stored in MinIO

2. **Workflow Triggering**
   - Directus webhook → Orchestration API
   - Email signal → Orchestration API
   - Temporal workflow started

3. **Processing Pipeline**
   - **Classification**: Determine document type
   - **Parsing/OCR**: Extract text and layout
   - **LLM Extraction**: Extract structured data
   - **Validation**: Validate and enrich data
   - **Human Review**: Manual review if needed
   - **Export**: Generate CSV output
   - **Delivery**: Send to target systems

4. **Notifications**
   - Slack/Email notifications for key events
   - Progress tracking via Temporal UI

## Quick Start

### Environment Configuration

1. **Copy environment template**:
   ```bash
   cp ENVIRONMENT.md .env
   ```

2. **Configure required variables**:
   See `ENVIRONMENT.md` for complete configuration guide. **Essential variables:**
   - `PROJECT_PREFIX` - Container naming prefix
   - `POSTGRES_PASSWORD` - Database password
   - `KEYDB_PASSWORD` - Cache password
   - `MINIO_ACCESS_KEY/SECRET_KEY` - Storage credentials
   - `ADMIN_EMAIL/PASSWORD` - Directus admin
   - `KEY/SECRET` - Directus security keys
   - `TEMPORAL_ADDRESS` - Workflow engine
   - `API_SECRET_KEY/WEBHOOK_SECRET` - API security

3. **Generate security keys**:
   ```bash
   # Generate Directus keys
   openssl rand -hex 16    # For KEY
   openssl rand -base64 32 # For SECRET
   
   # Generate API keys
   openssl rand -hex 32    # For API_SECRET_KEY
   openssl rand -hex 32    # For WEBHOOK_SECRET
   ```

### Running the Complete System

1. **Start all services**:
   ```bash
   # Using Docker Compose
   docker compose up -d
   
   # Or using Make
   make start
   ```

2. **Import Directus schema** (required for first setup):
   ```bash
   # Interactive import with backup and confirmation
   make import-schema
   
   # Or quick import (no prompts)
   make quick-import
   
   # Or manual import
   ./scripts/import-directus-schema.sh
   ```

3. **Verify services are running**:
   ```bash
   # Check service status
   make status
   
   # Or use Docker Compose
   docker compose ps
   
   # Check health endpoints
   make health
   ```

4. **Access the services**:
   - **Directus CMS**: http://localhost:8055
   - **Temporal UI**: http://localhost:8085
   - **MinIO Console**: http://localhost:9001
   - **Orchestration API**: http://localhost:3001

5. **Monitor workflows**:
   - View workflow executions in Temporal UI
   - Check logs: `make logs` or `docker compose logs -f [service-name]`

### Service Overview

The complete system includes:

- **Directus CMS** (port 8055) - Content management and API
- **Temporal Server** (port 7233) - Workflow orchestration
- **Temporal UI** (port 8085) - Workflow monitoring
- **PostgreSQL** (port 5432) - Primary database
- **KeyDB** (port 6379) - Cache and session storage
- **MinIO** (ports 9000/9001) - Object storage
- **Orchestration API** (port 3001) - Webhook and workflow management
- **Email Collector** (port 3002) - Email processing
- **Worker Services** - Document processing activities

## Directus Schema

The system includes a comprehensive Directus schema with the following collections:

- **documents** - Main document records with status tracking
- **email_messages** - Incoming email processing
- **email_attachments** - Email attachment handling
- **extraction_jobs** - Document processing job tracking
- **artifacts** - Document processing artifacts (OCR, parsed text)
- **extractions** - Extracted structured data
- **extraction_fields** - Field definition schemas
- **review_tasks** - Human review task management
- **exports** - Export operation tracking
- **deliveries** - Delivery status and tracking
- **integration_targets** - External system configurations
- **schema_definitions** - Schema version management
- **master_vendors** - Vendor master data
- **activity_log** - System activity and audit trail

## Make Commands

The project includes a Makefile for common operations:

```bash
make help           # Show all available commands
make start          # Start all services
make stop           # Stop all services
make status         # Check service status
make logs           # View all service logs
make health         # Check service health endpoints

# Schema management
make import-schema  # Import Directus schema (interactive)
make quick-import   # Quick import schema (no prompts)
make backup         # Backup current schema

# Development
make dev-setup      # Start services and import schema
make clean          # Remove all containers and volumes

# Logs for specific services
make logs-directus
make logs-temporal
make logs-workers
make logs-orchestration
make logs-email

# Database access
make db            # Connect to PostgreSQL
```

## API Endpoints

### Orchestration API (localhost:3001)

- `GET /health` - Health check
- `POST /webhooks/directus/document-created` - Directus document upload webhook
- `POST /webhooks/directus/review-approved` - Document review approval webhook
- `POST /workflows/start` - Manually start workflow
- `GET /workflows/:workflowId/status` - Get workflow status
- `POST /workflows/:workflowId/signal/:signalName` - Send signal to workflow
- `POST /workflows/:workflowId/cancel` - Cancel workflow
- `GET /workflows` - List workflows

### Email Collector (localhost:3002)

- `GET /health` - Health check
- Email processing runs automatically based on configuration

## Development

### Adding New Activities

1. Define activity interface in `orchestration-api/src/temporal/activities.ts`
2. Implement activity in appropriate worker service
3. Add activity to worker's activity list
4. Update workflow to use the new activity

### Extending Workers

Each worker type has its own Docker container and can be scaled independently:

```bash
# Scale specific worker types
docker compose up -d --scale worker-classify=3
docker compose up -d --scale worker-llm-extract=2
```

### Monitoring and Debugging

- **Temporal UI**: View workflow executions, activity retries, and errors
- **Service logs**: `docker compose logs -f [service-name]`
- **Database**: Connect to PostgreSQL for data inspection
- **Storage**: Access MinIO console for file management

### Configuration Management

- **Environment variables**: See `ENVIRONMENT.md` for complete reference
- **Scaling**: Adjust replica counts in environment variables
- **LLM providers**: Configure OpenAI or Anthropic API keys
- **Email sources**: Configure IMAP, Gmail API, or Microsoft Graph

## Troubleshooting

- **Port conflicts**: Check if required ports are already in use
- **Volume conflicts**: Ensure unique Docker volume names
- **Container conflicts**: Verify unique container names
- **Permission issues**: Adjust file permissions for mounted volumes
- **Service dependencies**: Ensure dependent services start in correct order
- **Memory issues**: Increase Docker memory limits for worker services