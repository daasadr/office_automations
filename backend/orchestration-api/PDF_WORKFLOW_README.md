# PDF Workflow Implementation

This document describes the PDF splitting and processing workflow implementation using BullMQ.

## Overview

The PDF workflow processes uploaded PDF documents by splitting them into individual pages, processing each page with LLM for data extraction, and optionally syncing results to an ERP system.

## Architecture

```
┌─────────────────┐
│  API Endpoint   │
│  POST /workflows│
│       /pdf      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Directus DB   │
│  Create Workflow│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  pdf-workflow   │
│     Queue       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PDF Worker      │
│ - Downloads PDF │
│ - Splits pages  │
│ - Uploads pages │
│ - Creates steps │
└────────┬────────┘
         │
         ├──────────┬──────────┬─────────┐
         ▼          ▼          ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ...
    │Page 1  │ │Page 2  │ │Page 3  │
    │LLM Job │ │LLM Job │ │LLM Job │
    └───┬────┘ └───┬────┘ └───┬────┘
        │          │          │
        ▼          ▼          ▼
    ┌────────────────────────────┐
    │    LLM Worker              │
    │ - Downloads page from MinIO│
    │ - Runs Gemini analysis     │
    │ - Stores results in DB     │
    │ - Checks completion        │
    └────────────────────────────┘
```

## Components

### 1. Directus File Management

All file operations go through Directus, which internally uses MinIO for storage:

- **`directusDocumentService.downloadFile(fileId)`** - Downloads a file from Directus
- **`directusDocumentService.uploadFile(options)`** - Uploads a file to Directus
- Directus manages file metadata, permissions, and storage automatically

### 2. PDF Split Service (`src/services/PdfSplitService.ts`)

Handles PDF splitting operations using `pdf-lib`:

```typescript
const result = await pdfSplitService.splitPdfIntoPages({
  workflowId: "uuid",
  fileId: "directus-file-id"
});
```

**Returns:**
```typescript
{
  pages: [
    {
      pageNumber: 1,
      fileId: "directus-file-id-for-page-1",
      mimeType: "application/pdf",
      size: 12345
    },
    // ... more pages
  ],
  totalPages: 10,
  processingTimeMs: 1234,
  originalFileId: "directus-file-id"
}
```

**Features:**
- Downloads PDF from Directus (which uses MinIO internally)
- Extracts each page as a separate PDF
- Uploads each page back to Directus with proper metadata
- All files managed through Directus file system
- Handles partial failures gracefully

### 3. PDF Workflow Worker (`src/workers/pdfWorkflowWorker.ts`)

Orchestrates the PDF processing workflow:

**Process:**
1. Updates workflow state to `splitting`
2. Calls `pdfSplitService.splitPdfIntoPages()`
3. Creates a `document` record in Directus
4. Creates workflow steps for each page
5. Creates `document_page` records
6. Enqueues LLM jobs for each page
7. Updates workflow state to `processing`

**Configuration:**
- Concurrency: 2 (to avoid memory issues with large PDFs)
- Retries: 3 attempts with exponential backoff

### 4. Page LLM Worker (`src/workers/pageLlmWorker.ts`)

Processes individual pages with Gemini:

**Process:**
1. Checks if page already processed (idempotency)
2. Updates step state to `running`
3. Downloads page from Directus
4. Runs `validatePdfContentWithGemini()` on the page
5. Saves LLM results to `document_pages` table
6. Updates step state to `succeeded`
7. Checks if all pages complete → marks workflow as `completed`

**Configuration:**
- Concurrency: 3 (to control LLM API rate limits)
- Retries: 5 attempts with 8s initial backoff

## API Usage

### Create a PDF Processing Workflow

```bash
POST /workflows/pdf
Content-Type: application/json

{
  "fileId": "directus-file-uuid",
  "fileName": "invoice.pdf",
  "mimeType": "application/pdf",
  "source": "upload",
  "priority": 1,
  "tenantId": "optional-tenant-uuid"
}
```

**Response:**
```json
{
  "workflowId": "uuid",
  "status": "queued",
  "message": "Workflow created and queued for processing"
}
```

### Get Workflow Status

```bash
GET /workflows/{workflowId}
```

**Response:**
```json
{
  "workflow": {
    "id": "uuid",
    "state": "processing",
    "type": "pdf_processing",
    "total_steps": 10,
    "completed_steps": 7,
    "input_file_name": "invoice.pdf",
    // ... more fields
  },
  "steps": [
    {
      "id": "step-uuid",
      "kind": "page_llm",
      "state": "succeeded",
      "page_number": 1,
      // ... more fields
    },
    // ... more steps
  ],
  "progress": {
    "total": 10,
    "completed": 7,
    "failed": 0,
    "percentage": 70
  }
}
```

## File Storage Structure

Files are managed by **Directus**, which internally stores them in MinIO:

- Original PDF: Uploaded to Directus via your upload endpoint
- Page PDFs: Created by the PDF worker and uploaded to Directus
- Each file gets a Directus file ID for tracking
- Directus manages permissions, metadata, and storage
- Files are stored in MinIO but accessed through Directus API

## Database Schema

### Tables Used

1. **`workflows`** - Main workflow records
2. **`workflow_steps`** - Individual page processing steps
3. **`documents`** - Logical document records
4. **`document_pages`** - Individual pages with LLM results

### Workflow States

- `queued` - Workflow created, waiting to start
- `splitting` - PDF being split into pages
- `processing` - Pages being processed by LLM
- `aggregating` - Results being aggregated (future)
- `erp_sync` - Syncing to ERP (future)
- `completed` - All processing complete
- `failed` - Processing failed
- `cancelled` - Workflow cancelled by user

### Step States

- `queued` - Step created, waiting to process
- `running` - Step currently being processed
- `succeeded` - Step completed successfully
- `failed` - Step failed after all retries
- `skipped` - Step skipped (e.g., already processed)

## Running Workers

### Development

```bash
# Run all workers in separate terminals
npm run dev:worker:pdf    # PDF workflow orchestrator
npm run dev:worker:llm    # Page LLM processor
npm run dev:worker:erp    # ERP sync (future)
```

### Production

```bash
npm run build

# Start workers
npm run start:worker:pdf
npm run start:worker:llm
npm run start:worker:erp
```

### Docker

Add to `docker-compose.yml`:

```yaml
services:
  worker-pdf:
    build: ./backend/orchestration-api
    command: npm run start:worker:pdf
    environment:
      - NODE_ENV=production
      - REDIS_HOST=keydb
      - MINIO_ENDPOINT=minio
      - DIRECTUS_URL=http://directus:8055
      # ... other env vars
    depends_on:
      - keydb
      - minio
      - directus

  worker-llm:
    build: ./backend/orchestration-api
    command: npm run start:worker:llm
    environment:
      # ... same as above
    depends_on:
      - keydb
      - minio
      - directus
```

## Environment Variables

Required for PDF workflow:

```bash
# MinIO Configuration (optional, only if accessing MinIO directly)
# Files are managed through Directus, which uses MinIO internally
MINIO_ENDPOINT=minio
MINIO_API_PORT=9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_USE_SSL=false
MINIO_BUCKET=documents

# Redis/KeyDB Configuration (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Directus Configuration
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=your_static_token

# Gemini API Configuration
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
```

## Error Handling

### PDF Split Errors

If PDF splitting fails:
- Workflow state → `failed`
- Error details stored in `workflow.error_summary`
- Can be retried via `POST /workflows/{id}/retry`

### Page Processing Errors

If individual page processing fails:
- Step marked as `failed`
- Error stored in `workflow_step.error_detail`
- Other pages continue processing
- If some pages succeed: workflow completes with partial results
- If all pages fail: workflow marked as `failed`

### Rate Limiting

LLM worker handles rate limits:
- Detects 429 errors from Gemini API
- Throws error to trigger BullMQ retry with backoff
- Exponential backoff: 8s → 16s → 32s → 64s → 128s

## Monitoring

### Queue Stats

```bash
GET /workflows/stats
```

Returns:
- Workflows by state (queued, processing, completed, failed)
- BullMQ job counts (waiting, active, completed, failed)

### Logs

All operations are logged with structured logging:

```
[PdfSplitService] Starting PDF split
[PdfSplitService] PDF loaded { totalPages: 10 }
[PdfWorker] PDF workflow started successfully
[LlmWorker] Processing page { pageNumber: 1, totalPages: 10 }
```

## Dependencies

- **`pdf-lib`** - PDF manipulation library for splitting
- **`@aws-sdk/client-s3`** - MinIO/S3 client
- **`bullmq`** - Queue management
- **`@google/generative-ai`** - Gemini API client
- **`@directus/sdk`** - Directus database client

## Next Steps

To implement in your waste management flow:

1. **Upload PDF to Directus** first (via Directus file upload or your existing endpoint)
2. **Get the Directus file ID** from the upload response
3. **Create workflow** with the Directus file ID
4. **Workers automatically process** the PDF
5. **Query workflow status** to track progress
6. **Access results** from `document_pages.llm_result` field

This is separate from your existing waste records flow and only runs when explicitly triggered via the workflow API.

**Important**: All file operations go through Directus, which manages MinIO internally. You should never access MinIO directly.




