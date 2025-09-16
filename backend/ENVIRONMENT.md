# Environment Variables

This document describes all environment variables needed for the complete document processing system.

## Core Project Configuration

```bash
# Project settings
PROJECT_PREFIX=spur_odpady_                    # Used for container/volume naming
NODE_ENV=development                           # Environment mode
LOG_LEVEL=info                                # Logging level
```

## Database Configuration

```bash
# PostgreSQL Database
POSTGRES_DB=directus
POSTGRES_USER=directus
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_PORT=5432

# Alternative database variables for services that use different naming
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=directus
DB_USER=directus
DB_PASSWORD=your_secure_db_password
```

## Cache/Session Store (KeyDB/Redis)

```bash
KEYDB_PASSWORD=your_secure_redis_password
REDIS_PASSWORD=your_secure_redis_password
REDIS_PORT=6379
CACHE_NAMESPACE=directus_cache
```

## File Storage (MinIO/S3)

```bash
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_secure_minio_secret
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_BROWSER_REDIRECT_URL=http://localhost:9001

# Storage configuration for services
STORAGE_MINIO_KEY=your_minio_access_key       # Fallback: uses MINIO_ACCESS_KEY
STORAGE_MINIO_SECRET=your_secure_minio_secret # Fallback: uses MINIO_SECRET_KEY
STORAGE_MINIO_BUCKET=spur_odpady_             # Fallback: uses PROJECT_PREFIX
STORAGE_MINIO_ENDPOINT=http://spur_odpady_-minio:9000

# S3 configuration for workers (uses MinIO as S3-compatible storage)
S3_ENDPOINT=http://spur_odpady_-minio:9000
S3_ACCESS_KEY=your_minio_access_key           # Fallback: uses MINIO_ACCESS_KEY
S3_SECRET_KEY=your_secure_minio_secret        # Fallback: uses MINIO_SECRET_KEY
S3_BUCKET=spur_odpady_                        # Fallback: uses PROJECT_PREFIX
S3_REGION=us-east-1
```

## Directus CMS Configuration

```bash
PORT=8055
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your_secure_admin_password
KEY=your_32_character_random_key_here          # Generate with: openssl rand -hex 16
SECRET=your_random_secret_string_here          # Generate with: openssl rand -base64 32
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=your_directus_admin_token
DIRECTUS_API_TOKEN=your_directus_api_token
```

## Temporal Workflow Engine

```bash
TEMPORAL_PORT=7233
TEMPORAL_UI_PORT=8085                        # UI available with debug profile
TEMPORAL_ADDRESS=spur_odpady_-temporal:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=document-processing
```

## Orchestration API

```bash
ORCHESTRATION_PORT=3001
API_SECRET_KEY=your_api_secret_key
WEBHOOK_SECRET=your_webhook_secret
CORS_ORIGIN=http://localhost:3000,http://localhost:8055
```

## Worker Configuration

```bash
# Unified worker replicas (handles all activity types)
UNIFIED_WORKER_REPLICAS=1
TASK_QUEUE=default                           # Used by workers for task queue name
```

## LLM Provider Configuration

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Anthropic Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## OCR Configuration

```bash
TESSERACT_LANG=ces+eng                        # OCR languages (Czech + English)
```

## Email Collector Configuration

```bash
EMAIL_CHECK_INTERVAL=60000                    # Check interval in milliseconds
ALLOWED_SENDERS=sender1@example.com,sender2@example.com
ALLOWED_EXTENSIONS=pdf,jpg,jpeg,png,tiff
MAX_ATTACHMENT_SIZE=10485760                  # 10MB in bytes
```

### IMAP Configuration

```bash
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your_email@gmail.com
IMAP_PASSWORD=your_app_password               # Gmail App Password
IMAP_MAILBOX=INBOX
```

### Gmail API Configuration (Alternative to IMAP)

```bash
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
```

### Microsoft Graph API Configuration

```bash
MS_TENANT_ID=your_ms_tenant_id
MS_CLIENT_ID=your_ms_client_id
MS_CLIENT_SECRET=your_ms_client_secret
```

## Notification Configuration

```bash
# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Email Notifications
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_smtp_user
EMAIL_SMTP_PASSWORD=your_smtp_password
EMAIL_FROM=noreply@yourcompany.com
```

## Integration Configuration

```bash
SFTP_ENABLED=false                           # Enable SFTP delivery
API_INTEGRATIONS_ENABLED=false              # Enable API integrations
VALIDATION_API_KEY=your_validation_api_key   # External validation service
```

## Required Environment Variables

The following variables are **required** and must be set:

- `PROJECT_PREFIX`
- `POSTGRES_PASSWORD`
- `KEYDB_PASSWORD` or `REDIS_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `KEY`
- `SECRET`
- `TEMPORAL_ADDRESS`
- `API_SECRET_KEY`
- `WEBHOOK_SECRET`
- `DIRECTUS_URL`
- `DB_HOST`
- `DB_PASSWORD`

## Security Key Generation

Generate secure random keys using:

```bash
# Generate KEY (32 characters)
openssl rand -hex 16

# Generate SECRET (longer random string)
openssl rand -base64 32

# Generate API keys
openssl rand -hex 32
```

## Setup Instructions

1. Copy the environment template:
   ```bash
   cp ENVIRONMENT.md .env
   ```

2. Edit `.env` and fill in all required variables

3. Generate secure keys for all secret variables

4. **Never commit `.env` files** to version control

5. Use a secure vault for production secrets

## Service-Specific Notes

### Directus
- Requires database connection
- Uses MinIO for file storage
- Needs Redis for caching

### Temporal
- Requires PostgreSQL for persistence
- Runs on port 7233 (gRPC)
- UI available on port 8085 with debug profile

### Workers
- Unified worker architecture handles all activity types
- Scale workers using UNIFIED_WORKER_REPLICAS
- Connects to Temporal, PostgreSQL, and MinIO

### Email Collector
- Can use IMAP, Gmail API, or Microsoft Graph
- Processes attachments and stores in MinIO
- Connects to Temporal for workflow triggering
- Includes health check on port 3002

### Orchestration API
- Handles webhooks from Directus with HMAC signature validation
- Manages workflow lifecycle through Temporal
- Provides REST API for workflow control
- Includes security features: replay attack prevention, timing-safe comparisons
- Health check available on port 3001


