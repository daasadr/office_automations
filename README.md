# Office Automations - Document Processing System

A streamlined document processing system for automating PDF document validation and Excel conversion workflows. Currently focused on waste management documentation ("průběžná evidence odpadů") with AI-powered content validation.

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

- **PDF Document Processing**: Upload and validate PDF documents
- **AI-Powered Content Validation**: Gemini API integration for intelligent document analysis
- **Excel Generation**: Automated conversion of validated data to Excel format
- **Real-time Processing Status**: Track processing progress with job management
- **Modern Web Interface**: Responsive frontend built with Astro and React
- **Type-Safe Development**: Full TypeScript implementation

### Key Capabilities

- Processes Czech waste management documents ("průběžná evidence odpadů")
- Extracts structured data from PDF documents using AI
- Validates document completeness and accuracy
- Generates formatted Excel reports
- Handles multiple document formats (PDF focus)
- In-memory job tracking and status reporting

## Architecture

### Current System Components

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Orchestration  │
│   (Astro)       │◄──►│      API        │
│                 │    │   (Express)     │
└─────────────────┘    └─────────────────┘
         │                        │
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│   Gemini AI     │    │   In-Memory     │
│  (Google API)   │◄──►│  Job Storage    │
│                 │    │                 │
└─────────────────┘    └─────────────────┘
```

**Current Architecture:**
- **Frontend**: Astro-based web application for file upload and result display
- **Orchestration API**: Express.js server handling PDF processing and Excel generation
- **Gemini AI**: Google's Generative AI for document content analysis
- **Job Management**: In-memory job tracking and status management

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

**AI & Processing:**
- **Google Gemini API** - Document analysis and content extraction
- **XLSX** - Excel file generation and manipulation

**Infrastructure:**
- **Docker** - Containerization (orchestration API only)

### Data Flow

1. **Document Upload** → User uploads PDF via frontend interface
2. **Job Creation** → API creates processing job with unique ID
3. **AI Processing** → Gemini API analyzes PDF content and extracts data
4. **Validation** → System validates extracted data against required fields
5. **Excel Generation** → XLSX library creates formatted Excel file
6. **Result Delivery** → User downloads generated Excel file

### Planned Features

As the application grows, the following components are planned for implementation:

**Advanced Workflow Management:**
- **Temporal** - Robust workflow orchestration engine
- **PostgreSQL** - Persistent data storage
- **MinIO** - S3-compatible object storage for file management

**Enhanced Processing:**
- **Multi-stage Workflows** - Classification, extraction, validation, and delivery
- **Human-in-the-loop** - Manual review and approval processes
- **OCR Integration** - Tesseract.js for image-based document processing

**Content Management:**
- **Directus CMS** - Headless CMS and admin interface
- **Advanced Schema Management** - Flexible document type definitions

**Communication & Integration:**
- **Email Integration** - Automated email collection and processing
- **Webhook Support** - Real-time notifications and integrations
- **KeyDB/Redis** - Caching and session management

**Monitoring & Operations:**
- **Advanced Logging** - Centralized log aggregation
- **Health Monitoring** - Comprehensive service health checks
- **Performance Metrics** - Detailed processing analytics

## Quick Start

### Prerequisites

- **Docker** (v20.0+) for containerized API deployment
- **Node.js** (v18+) for local development
- **Git** for version control
- **Google Gemini API Key** for document processing

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd office_automations
   ```

2. **Set up environment variables:**
   ```bash
   # Backend API environment
   cd backend/orchestration-api
   cp .env.example .env
   
   # Edit with your settings
   nano .env
   ```

3. **Configure required environment variables:**
   ```bash
   # Minimum required variables:
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3001
   NODE_ENV=development
   LOG_LEVEL=info
   CORS_ORIGIN=http://localhost:3000,http://localhost:4321
   ```

### Running the Application

**Option 1: Docker (Recommended for API)**
```bash
# Start the orchestration API
cd backend
docker compose up -d

# Start frontend development server
cd ../frontend
npm install
npm run dev
```

**Option 2: Local Development**
```bash
# Start the API locally
cd backend/orchestration-api
npm install
npm run dev

# Start frontend in another terminal
cd frontend
npm install
npm run dev
```

**Access the applications:**
- **Frontend Application**: http://localhost:4321
- **Orchestration API**: http://localhost:3001
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

#### Orchestration API
**Technology:** Express.js + TypeScript
**Port:** 3001
**Purpose:** Central API for document processing workflow

**Current Endpoints:**
- `POST /documents/validate-pdf` - Upload and validate PDF documents
- `GET /documents/status/:jobId` - Check processing status
- `POST /documents/generate-excel` - Generate Excel from validation results
- `GET /documents/download/:jobId/:filename` - Download generated Excel
- `GET /documents/jobs` - List all processing jobs (admin)
- `GET /health` - Health check and service status

**Key Features:**
- PDF file upload with validation (10MB limit)
- Gemini AI integration for content analysis
- In-memory job tracking and status management
- Excel file generation with structured data
- CORS support for frontend integration
- Structured logging with Winston

## Configuration

### Environment Variables

**Required:**
- `GEMINI_API_KEY` - Google Gemini API key for document processing
- `PORT` - API server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
- `LOG_LEVEL` - Logging level (info/debug/warn/error)
- `CORS_ORIGIN` - Allowed CORS origins for frontend access

**Example `.env` file:**
```bash
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000,http://localhost:4321
```

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

Response:
{
  "success": true,
  "jobId": "job_1234567890_abc123",
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

**API won't start:**
```bash
# Check if port is available
lsof -i :3001

# Check environment variables
cd backend/orchestration-api
cat .env

# Check logs
npm run dev
# or with Docker
docker compose logs orchestration-api
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
```

### Performance Notes

**Current Limitations:**
- In-memory job storage (jobs lost on restart)
- Single-threaded processing
- No persistent file storage

**Optimization Tips:**
- Use smaller PDF files when possible
- Monitor Gemini API rate limits
- Consider implementing job persistence for production use

## Roadmap

### Phase 1: Current Implementation ✅
- **PDF Processing**: Upload and AI-powered validation
- **Excel Generation**: Structured data export
- **Simple Workflow**: Direct API processing
- **Basic UI**: File upload and download interface

### Phase 2: Enhanced Processing (Planned)
- **Temporal Integration**: Robust workflow orchestration
- **Database Persistence**: PostgreSQL for job and result storage
- **File Storage**: MinIO for document and result management
- **Advanced Validation**: Multi-stage processing pipeline

### Phase 3: Advanced Features (Planned)
- **Directus CMS**: Admin interface and content management
- **Human-in-the-loop**: Manual review and approval workflows
- **Email Integration**: Automated document collection
- **OCR Support**: Image-based document processing

### Phase 4: Enterprise Features (Future)
- **Multi-tenant Support**: Organization and user management
- **Advanced Analytics**: Processing metrics and reporting
- **API Integrations**: Third-party system connections
- **Scalability**: Horizontal scaling and load balancing

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
cd backend/orchestration-api
npm run dev

# Start frontend
cd frontend
npm run dev

# Make changes and test locally
# Build and verify
npm run build
```

## License

[License information to be added]

---

For additional support or questions, please refer to the project documentation or create an issue in the repository.
