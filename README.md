# Office Automations - Document Processing System

A comprehensive document processing system for automating PDF document validation and Excel conversion workflows, built with microservices architecture using Docker, Temporal workflows, and modern web technologies.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [System Components](#system-components)
  - [Technology Stack](#technology-stack)
  - [Data Flow](#data-flow)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Running the Application](#running-the-application)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Available Commands](#available-commands)
  - [Service Management](#service-management)
- [Services](#services)
  - [Frontend Application](#frontend-application)
  - [Backend Services](#backend-services)
  - [Infrastructure Services](#infrastructure-services)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

This office automation system processes PDF documents, validates their content, and converts them to Excel format. It's designed to handle waste management documentation ("průběžná evidence odpadů") with intelligent content validation and automated workflow processing.

**Note:** This system is currently designed to operate behind a company VPN for security purposes and is not intended for direct public internet exposure.

### Key Features

- **PDF Document Processing**: Upload, validate, and convert PDF documents to Excel
- **Intelligent Content Validation**: AI-powered document analysis and validation
- **Workflow Automation**: Temporal-based workflow orchestration
- **Multi-format Support**: PDF, images, and various document formats
- **Real-time Processing**: WebSocket-based progress tracking
- **Email Integration**: Automated email collection and processing
- **Scalable Architecture**: Microservices with horizontal scaling capabilities

## Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Orchestration  │    │    Workers      │
│   (Astro)       │◄──►│      API        │◄──►│   (Temporal)    │
│                 │    │   (Express)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Directus     │    │   PostgreSQL    │    │     MinIO       │
│     (CMS)       │◄──►│   (Database)    │    │  (File Storage) │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     KeyDB       │    │    Temporal     │    │   Email         │
│   (Redis Cache) │    │  (Workflows)    │    │  Collector      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

**Frontend:**
- **Astro** - Modern web framework with SSR
- **React** - UI components and interactivity
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives

**Backend:**
- **Node.js** - Runtime environment
- **Express.js** - Orchestration API server
- **Temporal** - Workflow orchestration engine
- **TypeScript** - Type-safe development

**Data & Storage:**
- **PostgreSQL** - Primary database
- **MinIO** - S3-compatible object storage
- **KeyDB** - Redis-compatible cache/session store
- **Directus** - Headless CMS and admin interface

**Infrastructure:**
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **MailHog** - Email testing (development)

**AI & Processing:**
- **OpenAI API** - Document analysis and validation
- **Anthropic Claude** - Alternative LLM provider
- **Tesseract.js** - OCR processing
- **Sharp** - Image processing
- **PDF-Parse** - PDF content extraction

### Data Flow

1. **Document Upload** → Frontend uploads files to Orchestration API
2. **Workflow Initiation** → API triggers Temporal workflow
3. **Document Processing** → Workers handle OCR, validation, and conversion
4. **Content Analysis** → AI services analyze and validate document content
5. **Result Generation** → Excel files generated and stored in MinIO
6. **Notification** → Users notified of completion via email/UI

## Quick Start

### Prerequisites

- **Docker** (v20.0+) and **Docker Compose** (v2.0+)
- **Node.js** (v18+) for local development
- **Git** for version control
- **Make** (optional, for convenience commands)

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd office_automations
   ```

2. **Set up environment variables:**
   ```bash
   # Copy environment template
   cp backend/ENVIRONMENT.md backend/.env
   
   # Edit the .env file with your settings
   nano backend/.env
   ```

3. **Generate required security keys:**
   ```bash
   # Generate Directus KEY (32 characters)
   openssl rand -hex 16
   
   # Generate Directus SECRET
   openssl rand -base64 32
   
   # Generate API keys
   openssl rand -hex 32
   ```

4. **Configure required environment variables:**
   ```bash
   # Minimum required variables:
   PROJECT_PREFIX=spur_odpady_
   POSTGRES_PASSWORD=your_secure_password
   KEYDB_PASSWORD=your_redis_password
   MINIO_ACCESS_KEY=your_minio_key
   MINIO_SECRET_KEY=your_minio_secret
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=your_admin_password
   KEY=your_32_char_directus_key
   SECRET=your_directus_secret
   API_SECRET_KEY=your_api_secret
   WEBHOOK_SECRET=your_webhook_secret
   ```

### Running the Application

1. **Start all services:**
   ```bash
   cd backend
   make start
   # or
   docker compose up -d
   ```

2. **Import Directus schema:**
   ```bash
   make import-schema
   # or for quick setup
   make quick-import
   ```

3. **Start frontend development server:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the applications:**
   - **Frontend Application**: http://localhost:4321
   - **Directus Admin**: http://localhost:8055
   - **Temporal UI**: http://localhost:8085
   - **MinIO Console**: http://localhost:9001
   - **Orchestration API**: http://localhost:3001

## Development

### Project Structure

```
office_automations/
├── backend/                      # Backend services
│   ├── docker/                   # Docker service configurations
│   │   ├── postgres/            # Database configuration
│   │   ├── temporal/            # Workflow engine
│   │   ├── directus/            # CMS configuration
│   │   ├── minio/               # Object storage
│   │   ├── keydb/               # Cache/session store
│   │   ├── orchestration/       # API orchestration service
│   │   ├── workers/             # Worker services
│   │   └── email-collector/     # Email processing
│   ├── orchestration-api/       # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/          # API endpoints
│   │   │   ├── middleware/      # Custom middleware
│   │   │   ├── temporal/        # Temporal client & workflows
│   │   │   └── utils/           # Utilities
│   │   └── package.json
│   ├── workers/                 # Temporal workers
│   │   ├── src/
│   │   │   ├── activities/      # Temporal activities
│   │   │   ├── workflows/       # Workflow definitions
│   │   │   └── workers/         # Worker implementations
│   │   └── package.json
│   ├── extensions/              # Directus extensions
│   ├── schema/                  # Database schemas
│   ├── scripts/                 # Utility scripts
│   ├── docker-compose.yml       # Main compose file
│   └── Makefile                 # Development commands
├── frontend/                    # Astro frontend application
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Astro pages & API routes
│   │   ├── layouts/             # Page layouts
│   │   ├── lib/                 # Utilities & integrations
│   │   └── styles/              # CSS styles
│   ├── public/                  # Static assets
│   ├── package.json
│   └── astro.config.mjs
└── README.md                    # This file
```

### Available Commands

**Backend (from `/backend` directory):**
```bash
make start              # Start all services
make stop               # Stop all services  
make logs               # View all logs
make status             # Check service status
make import-schema      # Import Directus schema
make backup             # Backup current schema
make clean              # Clean containers and volumes
make health             # Check service health
make dev-setup          # Complete development setup
```

**Frontend (from `/frontend` directory):**
```bash
npm run dev             # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
npm run check           # Run Astro checks
```

### Service Management

**Individual service logs:**
```bash
make logs-directus      # Directus logs
make logs-temporal      # Temporal logs  
make logs-workers       # Worker logs
make logs-orchestration # API logs
make logs-email         # Email collector logs
```

**Database access:**
```bash
make db                 # Connect to PostgreSQL
```

## Services

### Frontend Application

**Technology:** Astro + React + TypeScript
**Port:** 4321
**Purpose:** User interface for document upload and processing

**Key Features:**
- File upload with drag & drop
- Real-time processing status
- Download processed files
- Responsive design
- Accessibility compliant

### Backend Services

#### Orchestration API
**Technology:** Express.js + TypeScript
**Port:** 3001
**Purpose:** Central API for workflow coordination

**Security Features:**
- HMAC-SHA256 webhook signature validation
- Replay attack prevention with timestamp verification
- Timing-safe signature comparison
- Request authentication and payload integrity verification

**Endpoints:**
- `POST /webhooks/directus` - Directus webhook handler
- `POST /workflows/start` - Start processing workflow
- `GET /workflows/:id/status` - Check workflow status
- `GET /health` - Health check

#### Workers
**Technology:** Temporal Workers + TypeScript
**Purpose:** Background task processing

**Worker Types:**
- **Classification Worker** - Document type classification
- **Extraction Worker** - Content extraction and OCR
- **Validation Worker** - AI-powered content validation
- **Export Worker** - Excel file generation
- **Delivery Worker** - File delivery and notification
- **Notification Worker** - Email and webhook notifications

#### Email Collector
**Purpose:** Automated email processing and attachment handling

**Features:**
- IMAP/Gmail API/Microsoft Graph support
- Attachment filtering and validation
- Automatic workflow triggering

### Infrastructure Services

#### PostgreSQL
**Port:** 5432
**Purpose:** Primary database for all services

#### Directus CMS
**Port:** 8055
**Purpose:** Headless CMS and admin interface

#### Temporal
**Ports:** 7233 (gRPC), 8085 (UI)
**Purpose:** Workflow orchestration engine

#### MinIO
**Ports:** 9000 (API), 9001 (Console)
**Purpose:** S3-compatible object storage

#### KeyDB
**Port:** 6379
**Purpose:** Redis-compatible cache and session store

#### MailHog (Development)
**Port:** 8025
**Purpose:** Email testing in development

## Configuration

All configuration is managed through environment variables. See `backend/ENVIRONMENT.md` for complete documentation.

**Critical Settings:**
- **Database**: PostgreSQL connection settings
- **Storage**: MinIO/S3 configuration
- **AI Services**: OpenAI and Anthropic API keys
- **Email**: SMTP and IMAP settings
- **Security**: JWT secrets and API keys

## API Documentation

### Orchestration API

**Base URL:** `http://localhost:3001`

**Authentication:** Bearer token or API key

**Key Endpoints:**

```http
POST /workflows/start
Content-Type: application/json
Authorization: Bearer <token>

{
  "fileUrl": "string",
  "filename": "string", 
  "metadata": {
    "source": "upload|email",
    "priority": "high|normal|low"
  }
}
```

```http
GET /workflows/{workflowId}/status
Authorization: Bearer <token>

Response:
{
  "id": "string",
  "status": "running|completed|failed",
  "progress": 0-100,
  "result": {
    "outputFiles": ["url1", "url2"],
    "validationResults": {...}
  }
}
```

## Monitoring & Logging

**Service Health Checks:**
```bash
make health
```

**Log Aggregation:**
- All services use structured JSON logging
- Logs are accessible via Docker Compose
- Winston logger with configurable levels

**Monitoring Endpoints:**
- Temporal UI: http://localhost:8085
- MinIO Console: http://localhost:9001
- Directus Admin: http://localhost:8055

## Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check service status
make status

# View logs for issues
make logs

# Clean and restart
make clean
make start
```

**Database connection issues:**
```bash
# Check PostgreSQL container
docker compose logs postgres

# Verify environment variables
docker compose config
```

**Temporal workflow issues:**
```bash
# Check Temporal UI
open http://localhost:8085

# View worker logs
make logs-workers
```

**File upload/storage issues:**
```bash
# Check MinIO status
docker compose logs minio

# Verify bucket configuration
curl http://localhost:9000/minio/health/live
```

### Performance Tuning

**Worker Scaling:**
```bash
# Adjust worker replicas in docker-compose.yml
WORKER_CLASSIFY_REPLICAS=4
WORKER_LLM_REPLICAS=2
```

**Database Optimization:**
```bash
# Tune PostgreSQL settings in docker/postgres/config/postgresql.conf
shared_buffers = 256MB
max_connections = 100
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

**Development Workflow:**
```bash
# Start development environment
make dev-setup

# Make changes and test locally
npm run dev    # Frontend
make logs      # Monitor backend

# Run tests
npm test

# Build and verify
npm run build
```

## License

[License information to be added]

---

For additional support or questions, please refer to the project documentation or create an issue in the repository.
