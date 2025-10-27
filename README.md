# Office Automations - Document Processing System

A document processing system for automating PDF document validation, AI-powered content extraction, and Excel generation workflows. Features complete document lifecycle management with Directus CMS integration, asynchronous processing, and foundation document augmentation for waste management documentation ("průběžná evidence odpadů").

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [Current System Components](#current-system-components)
  - [Technology Stack](#technology-stack)
  - [Data Flow](#data-flow)
  - [Planned Features](#planned-features)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Running the Application](#running-the-application)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Available Commands](#available-commands)
- [Services](#services)
  - [Frontend Application](#frontend-application)
  - [Backend Services](#backend-services)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

This office automation system processes PDF documents, validates their content using AI, and converts them to Excel format. The current implementation focuses on a simple, efficient workflow optimized for waste management documentation processing.

**Note:** This system is currently designed to operate behind a company VPN for security purposes and is not intended for direct public internet exposure.

### Current Features

#### Document Processing
- **PDF Document Processing**: Upload and validate PDF documents with async processing
- **AI-Powered Content Extraction**: Gemini API integration for intelligent document analysis
- **Excel Generation**: Automated conversion of validated data to Excel format
- **Foundation Document Augmentation**: Automatically augment approved Excel templates with extracted data

#### Infrastructure & Data Management
- **Directus CMS Integration**: Complete document lifecycle management with persistent storage
- **PostgreSQL Database**: Persistent data storage for all documents and responses
- **MinIO Object Storage**: S3-compatible file storage for documents
- **KeyDB Cache**: Redis-compatible caching and session management

#### User Experience
- **Asynchronous Processing**: Immediate feedback with background AI processing
- **Real-time Status Tracking**: Poll-based status updates with detailed progress indicators
- **Modern Web Interface**: Responsive frontend built with Astro and React
- **Docker-Based Deployment**: Complete containerized infrastructure

#### Developer Experience
- **Type-Safe Development**: Full TypeScript implementation across frontend and backend
- **Comprehensive Logging**: Winston-based structured logging
- **Health Monitoring**: Service health checks and status endpoints
- **Extensible Architecture**: Service layer pattern with clean separation of concerns

### Key Capabilities

- Processes Czech waste management documents ("průběžná evidence odpadů")
- Extracts structured data from PDF documents using AI
- Validates document completeness and accuracy
- Generates formatted Excel reports
- Augments foundation Excel templates with extracted data
- Persistent storage and document lifecycle management
- Asynchronous processing with immediate user feedback
- Complete audit trail and version tracking

## Architecture

### Current System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Astro + React Web Application (Port 4321)              │   │
│  │   • File Upload UI  • Status Tracking  • Results Display │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP/REST API
┌───────────────────────────┼──────────────────────────────────────┐
│                    Backend Services Layer                         │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │   Orchestration API (Port 3001)                          │   │
│  │   • PDF Processing  • Excel Generation                   │   │
│  │   • Foundation Augmentation  • Job Management            │   │
│  └──────┬───────────┬──────────────┬───────────────┬────────┘   │
│         │           │              │               │             │
│  ┌──────▼──────┐ ┌──▼────────┐ ┌──▼──────────┐ ┌──▼─────────┐  │
│  │  Directus   │ │PostgreSQL │ │   MinIO     │ │   KeyDB    │  │
│  │   CMS       │ │ Database  │ │  Storage    │ │   Cache    │  │
│  │  (8055)     │ │  (5432)   │ │  (9000)     │ │  (6379)    │  │
│  └─────────────┘ └───────────┘ └─────────────┘ └────────────┘  │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                      External Services                            │
│  ┌──────────────────┐          ┌──────────────────┐             │
│  │   Gemini AI      │          │    MailHog       │             │
│  │  (Google API)    │          │  (Dev Email)     │             │
│  │                  │          │    (8025)        │             │
│  └──────────────────┘          └──────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

**Architecture Components:**

**Frontend Layer:**
- **Astro Web Application**: Modern SSR/SSG framework with React components
- **API Integration**: Proxies requests to orchestration API
- **Real-time Updates**: Poll-based status tracking with progress indicators

**Backend Services:**
- **Orchestration API**: Express.js server orchestrating document processing workflows
- **Directus CMS**: Headless CMS providing document management and admin interface
- **PostgreSQL**: Primary database for documents, responses, and metadata
- **MinIO**: S3-compatible object storage for file management
- **KeyDB**: Redis-compatible cache for sessions and temporary data

**External Services:**
- **Gemini AI**: Google's Generative AI for document content extraction
- **MailHog**: Email testing service for development

### Technology Stack

**Frontend:**
- **Astro** - Modern web framework with SSR
- **React** - UI components and interactivity
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives

**Backend:**
- **Node.js** - Runtime environment
- **Express.js** - API server and request handling
- **TypeScript** - Type-safe development
- **Multer** - File upload handling
- **Winston** - Structured logging
- **Directus SDK** - CMS integration and data management

**AI & Processing:**
- **Google Gemini API** - Document analysis and content extraction
- **XLSX** - Excel file generation and manipulation

**Infrastructure:**
- **Docker & Docker Compose** - Full containerization of all services
- **PostgreSQL** - Relational database
- **MinIO** - S3-compatible object storage
- **KeyDB** - Redis-compatible caching layer
- **Directus** - Headless CMS and admin interface
- **MailHog** - Email testing (development)

### Data Flow

#### Standard Document Processing

1. **Document Upload** → User uploads PDF via frontend interface
2. **Persistence** → Document saved to Directus with status "processing"
3. **Immediate Response** → User receives document UUID and is redirected to check page
4. **Async AI Processing** → Gemini API analyzes PDF content in background (10-30s)
5. **Response Storage** → Extracted data saved to Directus with relationships
6. **Status Update** → Document status updated to "completed"
7. **User Review** → Check page polls for status and displays results when ready
8. **Excel Generation** → User can download generated Excel file
9. **Foundation Processing** (Optional) → User can augment approved foundation template

#### Foundation Document Augmentation

1. **Retrieve Template** → Get last approved foundation document from Directus
2. **Download Excel** → Download attached Excel file from MinIO via Directus
3. **Sheet Matching** → Find sheets matching waste codes from extracted data
4. **Data Insertion** → Add extracted records to appropriate sheets and columns
5. **Create Draft** → Save augmented file as new draft foundation document
6. **Manual Review** → User reviews and approves changes in Directus admin

### Future Enhancements

The following features are planned for future development:

**Advanced Workflow Management:**
- **Temporal Integration** - Robust workflow orchestration engine for complex multi-step processes
- **Worker Processes** - Dedicated workers for parallel document processing

**Enhanced Processing:**
- **Multi-stage Workflows** - Advanced classification, extraction, validation pipelines
- **OCR Integration** - Tesseract.js for image-based and scanned document processing
- **Batch Processing** - Handle multiple documents in a single workflow

**Communication & Integration:**
- **Email Integration** - Automated email collection and processing (infrastructure exists)
- **Webhook Support** - Real-time notifications and integrations
- **API Authentication** - OAuth2/JWT authentication for external integrations

**Monitoring & Operations:**
- **Centralized Logging** - Log aggregation with ELK stack or similar
- **Performance Metrics Dashboard** - Detailed processing analytics and visualization
- **Alerting System** - Automated alerts for failures and performance issues

## Quick Start

### Prerequisites

- **Docker Engine** (v24.0+) and Docker Compose (v2.20+)
- **Node.js** (v18+) for local frontend development
- **Git** for version control
- **Google Gemini API Key** for document processing
- **Minimum 4GB RAM** (8GB recommended)
- **10GB disk space** for Docker volumes

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd office_automations
   ```

2. **Set up backend environment variables:**
   ```bash
   cd backend
   # Create .env file (see backend/ENVIRONMENT.md for template)
   
   # Required variables:
   PROJECT_PREFIX=spur_odpady_
   POSTGRES_PASSWORD=your_secure_password
   KEYDB_PASSWORD=your_secure_password
   MINIO_ACCESS_KEY=your_access_key
   MINIO_SECRET_KEY=your_secret_key
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=your_admin_password
   KEY=$(openssl rand -hex 16)
   SECRET=$(openssl rand -base64 32)
   API_SECRET_KEY=$(openssl rand -hex 32)
   DIRECTUS_API_TOKEN=your_directus_token
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Set up frontend environment variables:**
   ```bash
   cd ../frontend
   cp env.example .env
   
   # For Docker deployment:
   DIRECTUS_URL=http://spur_odpady_-directus:8055
   ORCHESTRATION_API_URL=http://spur_odpady_-orchestration-api:3001
   
   # For local development:
   DIRECTUS_URL=http://localhost:8055
   ORCHESTRATION_API_URL=http://localhost:3001
   ```

### Running the Application

**Option 1: Full Docker Stack (Recommended)**
```bash
# 1. Start all backend services
cd backend
docker compose up -d

# Wait for services to be healthy (check with: docker compose ps)

# 2. Import Directus schema (first time only)
./scripts/quick-import-schema.sh

# 3. Start frontend
cd ../frontend
./docker-setup.sh  # or: docker compose up -d
```

**Option 2: Hybrid (Docker Backend + Local Frontend)**
```bash
# 1. Start backend services
cd backend
docker compose up -d

# 2. Install and run frontend locally
cd ../frontend
npm install
npm run dev
```

**Option 3: Local Development (Backend API only)**
```bash
# 1. Start infrastructure services
cd backend
docker compose up postgres directus minio keydb -d

# 2. Run orchestration API locally
cd orchestration-api
npm install
npm run dev

# 3. Run frontend locally (new terminal)
cd ../../frontend
npm install
npm run dev
```

**Access the applications:**
- **Frontend Application**: http://localhost:4321
- **Orchestration API**: http://localhost:3001
- **Directus Admin**: http://localhost:8055
- **MinIO Console**: http://localhost:9001
- **MailHog**: http://localhost:8025 (development)
- **API Health Check**: http://localhost:3001/health

## Development

### Project Structure

```
office_automations/
├── backend/                      # Backend services
│   ├── docker/                   # Docker service configurations
│   │   └── orchestration/        # API orchestration service
│   ├── orchestration-api/        # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/           # API endpoints
│   │   │   ├── services/         # Business logic (LLM, Excel, Jobs)
│   │   │   ├── middleware/       # Custom middleware
│   │   │   └── utils/            # Utilities and logging
│   │   └── package.json
│   └── docker-compose.yml        # Main compose file
├── frontend/                     # Astro frontend application
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/                # Astro pages & API routes
│   │   ├── layouts/              # Page layouts
│   │   ├── lib/                  # Utilities & integrations
│   │   └── styles/               # CSS styles
│   ├── public/                   # Static assets
│   ├── package.json
│   └── astro.config.mjs
└── README.md                     # This file
```

**Removed/Planned Components:**
```
backend/
├── workers/                      # [PLANNED] Temporal workers
├── extensions/                   # [PLANNED] Directus extensions
├── schema/                       # [PLANNED] Database schemas
└── scripts/                      # [PLANNED] Utility scripts
```

### Available Commands

**Backend API (from `/backend/orchestration-api` directory):**
```bash
npm install            # Install dependencies
npm run dev            # Start development server
npm run build          # Build TypeScript
npm start              # Start production server
npm test               # Run tests
```

**Docker (from `/backend` directory):**
```bash
docker compose up -d   # Start API container
docker compose logs    # View API logs
docker compose down    # Stop API container
```

**Frontend (from `/frontend` directory):**
```bash
npm install            # Install dependencies
npm run dev            # Start development server
npm run build          # Build for production
npm run preview        # Preview production build
npm run check          # Run Astro checks
```

## Services

### Frontend Application

**Technology:** Astro + React + TypeScript
**Port:** 4321
**Purpose:** User interface for document upload and processing

**Key Features:**
- File upload with drag & drop support
- Real-time processing status tracking
- Download processed Excel files
- Responsive design with modern UI
- Accessibility compliant components

### Backend Services

#### Service Overview

| Service | Port | Purpose | Technology |
|---------|------|---------|------------|
| **Frontend** | 4321 | Web interface | Astro + React |
| **Orchestration API** | 3001 | Document processing | Express.js + TypeScript |
| **Directus** | 8055 | CMS and admin interface | Directus 11 |
| **PostgreSQL** | 5432 | Database | PostgreSQL 16 |
| **MinIO** | 9000 | Object storage | MinIO (S3-compatible) |
| **MinIO Console** | 9001 | Storage admin UI | MinIO Console |
| **KeyDB** | 6379 | Cache layer | KeyDB (Redis-compatible) |
| **MailHog** | 8025 | Email testing | MailHog (dev only) |

#### Orchestration API
**Technology:** Express.js + TypeScript
**Port:** 3001
**Purpose:** Central API for document processing workflow

**Current Endpoints:**
- `POST /documents/validate-pdf` - Upload and validate PDF documents (async processing)
- `GET /documents/status/:jobId` - Check processing status (legacy, job ID based)
- `GET /documents/status-by-source/:sourceDocumentId` - Check status by Directus document UUID
- `POST /documents/generate-excel` - Generate Excel from validation results
- `POST /documents/process-foundation` - Augment foundation template with extracted data
- `GET /documents/download/:jobId/:filename` - Download generated Excel
- `GET /documents/jobs` - List all processing jobs (admin)
- `GET /health` - Health check and service status

**Key Features:**
- PDF file upload with validation (10MB limit)
- Asynchronous processing with immediate user feedback
- Gemini AI integration for content analysis
- Directus CMS integration for document lifecycle management
- Persistent storage in PostgreSQL via Directus
- Excel file generation with structured data
- Foundation document augmentation with sheet matching
- CORS support for frontend integration
- Structured logging with Winston
- Health checks and graceful degradation

## Configuration

### Environment Variables

#### Backend Services (backend/.env)

**Required:**
- `PROJECT_PREFIX` - Prefix for Docker container names (e.g., `spur_odpady_`)
- `GEMINI_API_KEY` - Google Gemini API key for document processing
- `POSTGRES_PASSWORD` - PostgreSQL database password
- `DIRECTUS_URL` - Directus API URL (e.g., `http://localhost:8055`)
- `DIRECTUS_TOKEN` - Directus admin API token
- `ADMIN_EMAIL` - Directus admin email
- `ADMIN_PASSWORD` - Directus admin password
- `KEY` - Directus encryption key (generate with `openssl rand -hex 16`)
- `SECRET` - Directus secret (generate with `openssl rand -base64 32`)

**Optional:**
- `PORT` - API server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Logging level (info/debug/warn/error)
- `CORS_ORIGIN` - Allowed CORS origins
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `KEYDB_PASSWORD` - KeyDB password

#### Frontend (frontend/.env)

**Required:**
- `DIRECTUS_URL` - Directus API URL
- `ORCHESTRATION_API_URL` - Orchestration API URL
- `DIRECTUS_TOKEN` - Directus token for frontend API calls

**Optional:**
- `SESSION_SECRET` - Session encryption secret

**See Also:**
- `backend/ENVIRONMENT.md` - Complete environment variable documentation
- `frontend/env.example` - Frontend environment template

### Gemini API Configuration

The system uses Google's Gemini AI for document processing. You'll need:

1. **Google Cloud Project** with Gemini API enabled
2. **API Key** with appropriate permissions
3. **Model Selection** (default: gemini-2.5-flash)

**Optional Gemini Settings:**
```bash
GEMINI_MODEL=gemini-2.5-flash  # AI model to use
```

## API Documentation

### Orchestration API

**Base URL:** `http://localhost:3001`

**Key Endpoints:**

#### Upload and Validate PDF
```http
POST /documents/validate-pdf
Content-Type: multipart/form-data

FormData:
- file: PDF file (max 10MB)

Response (Immediate - Async Processing):
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "directusSourceDocumentId": "uuid-abc-123",
  "status": "processing",
  "message": "Document uploaded successfully. Processing started.",
  "provider": "gemini"
}
```

#### Check Processing Status
```http
GET /documents/status/{jobId}

Response:
{
  "jobId": "job_1234567890_abc123",
  "status": "completed|processing|failed",
  "fileName": "document.pdf",
  "fileSize": 1024,
  "provider": "gemini",
  "error": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:01:00.000Z",
  "validationResult": {
    "present": ["field1", "field2"],
    "missing": ["field3"],
    "confidence": 85.5,
    "extracted_data": [...],
    "provider": "gemini"
  }
}
```

#### Generate Excel File
```http
POST /documents/generate-excel
Content-Type: application/json

{
  "jobId": "job_1234567890_abc123"
}

Response: Excel file download
```

#### Download Excel File
```http
GET /documents/download/{jobId}/{filename}

Response: Excel file download
```

#### Process Foundation Document
```http
POST /documents/process-foundation
Content-Type: application/json

{
  "jobId": "job_1234567890_abc123"
  // or "responseId": "uuid-response-id"
}

Response:
{
  "success": true,
  "foundationDocument": {
    "id": "uuid-foundation-doc",
    "title": "Master Template (Augmented 2025-10-27)",
    "status": "draft",
    "basedOn": {
      "id": "uuid-original",
      "title": "Master Template"
    }
  },
  "processing": {
    "sheetsModified": ["170103 12345678", "200301 87654321"],
    "extractedDataCount": 2,
    "confidence": 95.5
  }
}
```

#### Health Check
```http
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "api": "running",
    "gemini": "configured|not_configured"
  }
}
```

## Troubleshooting

### Common Issues

**Backend services won't start:**
```bash
# Check Docker service status
cd backend
docker compose ps

# View logs for specific service
docker compose logs orchestration-api
docker compose logs directus
docker compose logs postgres

# Check port availability
lsof -i :3001  # Orchestration API
lsof -i :8055  # Directus
lsof -i :5432  # PostgreSQL

# Check environment variables
cat .env

# Restart services
docker compose restart
```

**Gemini API issues:**
```bash
# Verify API key is set
echo $GEMINI_API_KEY

# Check API health
curl http://localhost:3001/health

# Test with a small PDF file first
```

**Frontend connection issues:**
```bash
# Check CORS configuration
# Ensure frontend URL is in CORS_ORIGIN

# Verify API is running
curl http://localhost:3001/health

# Check browser console for errors
```

**File upload issues:**
```bash
# Check file size (max 10MB)
# Verify file type (PDF only currently)
# Check server logs for detailed errors
docker compose logs -f orchestration-api
```

**Directus connection issues:**
```bash
# Check if Directus is running
curl http://localhost:8055/server/ping

# Verify Directus token
echo $DIRECTUS_TOKEN

# Import schema if database is empty
cd backend
./scripts/quick-import-schema.sh

# Check Directus logs
docker compose logs -f directus
```

**Database/Storage issues:**
```bash
# Check PostgreSQL connection
docker compose exec postgres pg_isready

# Check MinIO status
curl http://localhost:9000/minio/health/live

# View data volumes
docker volume ls | grep spur_odpady

# Reset database (WARNING: destroys data!)
docker compose down -v
docker compose up -d
./scripts/quick-import-schema.sh
```

### Performance Notes

**Current Architecture:**
- Persistent storage in PostgreSQL via Directus
- Asynchronous processing with immediate user feedback
- Single-threaded LLM processing (10-30 seconds per document)
- File storage in MinIO with deduplication
- Background processing queue (setImmediate)

**Optimization Tips:**
- Use smaller PDF files when possible (< 5MB recommended)
- Monitor Gemini API rate limits and quotas
- Consider implementing worker pools for parallel processing
- Enable KeyDB caching for frequently accessed documents
- Monitor Docker resource allocation (CPU, memory)

## Roadmap

### Phase 1: Core Infrastructure ✅ COMPLETE
- ✅ **PDF Processing**: Upload and AI-powered validation
- ✅ **Excel Generation**: Structured data export
- ✅ **Directus CMS**: Document lifecycle management
- ✅ **Database Persistence**: PostgreSQL for all data
- ✅ **File Storage**: MinIO object storage
- ✅ **KeyDB Cache**: Redis-compatible caching
- ✅ **Asynchronous Processing**: Background job processing
- ✅ **Modern UI**: Astro + React frontend

### Phase 2: Advanced Document Processing ✅ COMPLETE
- ✅ **Foundation Document Augmentation**: Excel template processing
- ✅ **Status Tracking**: Real-time processing status updates
- ✅ **Document Relationships**: Linked documents and versions
- ✅ **Health Monitoring**: Comprehensive health checks
- ✅ **Structured Logging**: Winston-based logging throughout

### Phase 3: Workflow Enhancement (In Progress)
- ⏳ **Temporal Integration**: Complex workflow orchestration
- ⏳ **Worker Processes**: Parallel document processing
- ⏳ **Email Integration**: Automated document collection (infrastructure exists)
- ⏳ **OCR Support**: Image-based document processing
- ⏳ **Batch Processing**: Multiple document workflows

### Phase 4: Enterprise Features (Future)
- ⏳ **Authentication & Authorization**: Multi-user access control
- ⏳ **Advanced Analytics**: Processing metrics dashboard
- ⏳ **API Integrations**: Webhooks and third-party connections
- ⏳ **Horizontal Scaling**: Load balancing and distributed processing
- ⏳ **Audit Trail**: Complete compliance logging

## Additional Documentation

### Backend Documentation
- **[Complete Docker Setup Guide](DOCKER_SETUP.md)** - Full stack Docker deployment
- **[Environment Variables](backend/ENVIRONMENT.md)** - Complete environment configuration
- **[Async Processing Flow](ASYNC_PROCESSING_FLOW.md)** - How asynchronous processing works
- **[Foundation Document Processing](FOUNDATION_PROCESSING_COMPLETE.md)** - Foundation augmentation feature
- **[Directus Integration](backend/orchestration-api/DIRECTUS_INTEGRATION.md)** - CMS integration details
- **[API Development Guide](backend/orchestration-api/DEVELOPMENT.md)** - Backend development

### Frontend Documentation
- **[Frontend Docker Setup](frontend/DOCKER_README.md)** - Frontend containerization
- **[Foundation Processing UI](frontend/FOUNDATION_PROCESSING_FRONTEND.md)** - UI implementation
- **[Base Path Configuration](frontend/BASE_PATH_IMPLEMENTATION.md)** - Path configuration

### Quick Reference Guides
- **[Quick Start Guide](QUICK_REFERENCE.md)** - Fast setup reference
- **[Quick Start: Directus](backend/orchestration-api/QUICK_START_DIRECTUS.md)** - Directus setup
- **[Quick Start: Foundation](backend/orchestration-api/QUICK_START_FOUNDATION.md)** - Foundation processing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Submit a pull request

**Development Workflow:**
```bash
# Start backend services
cd backend
docker compose up -d

# Start frontend development
cd ../frontend
npm install
npm run dev

# Make changes and test locally
# Build and verify
npm run build
npm run preview
```

## License

[License information to be added]

---

## Support

For additional support or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review the [documentation links](#additional-documentation)
- Examine Docker logs: `docker compose logs -f`
- Check service health: `curl http://localhost:3001/health`
- Create an issue in the repository

**Quick Health Check:**
```bash
# Check all services
cd backend
docker compose ps

# Test API
curl http://localhost:3001/health
curl http://localhost:8055/server/ping

# Test frontend
curl http://localhost:4321
```
