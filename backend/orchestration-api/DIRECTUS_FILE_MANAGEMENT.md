# Directus File Management Integration

## ✅ Complete Implementation

The PDF workflow system now uses **Directus for all file operations**, which internally manages MinIO storage. This is the proper architecture for this project.

## Why Directus for File Management?

### ✅ Advantages
- **Centralized Management**: All files tracked in Directus database
- **Permissions**: Directus handles file access control
- **Metadata**: File metadata stored alongside records
- **API Consistency**: Same API for all operations
- **No Direct MinIO Access**: Prevents bypassing Directus security

### ❌ Direct MinIO Access (Not Used)
- Bypasses Directus permissions
- No metadata tracking
- Files not visible in Directus admin
- Inconsistent with rest of application

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PDF Worker   │  │  LLM Worker  │  │  API Routes  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                               │
└────────────────────────────┼───────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   Directus Layer                         │
│                                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │   directusDocumentService                        │  │
│  │   - uploadFile(options)                          │  │
│  │   - downloadFile(fileId)                         │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│                     ▼                                    │
│          Directus File API (@directus/sdk)              │
│                     │                                    │
└─────────────────────┼────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Storage Layer                          │
│                                                           │
│                   MinIO (S3-compatible)                  │
│                   - Managed by Directus                  │
│                   - Never accessed directly              │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. PdfSplitService (Updated)

**Before:**
```typescript
// Direct MinIO access ❌
import { downloadFile, uploadFile } from "@orchestration-api/lib/minio";

const pdfBuffer = await downloadFile(fileKey, bucket);
```

**After:**
```typescript
// Through Directus ✅
import { directusDocumentService } from "@orchestration-api/lib/directus";

const pdfBuffer = await directusDocumentService.downloadFile(fileId);
```

### 2. pageLlmWorker (Updated)

**Before:**
```typescript
// Direct MinIO download ❌
import { downloadFile } from "@orchestration-api/lib/minio";

const buffer = await downloadFile(pageFileKey);
```

**After:**
```typescript
// Through Directus ✅
import { directusDocumentService } from "@orchestration-api/lib/directus";

const buffer = await directusDocumentService.downloadFile(pageFileId);
```

### 3. API Changes

**Before:**
```json
{
  "fileKey": "uploads/document.pdf"  // MinIO key ❌
}
```

**After:**
```json
{
  "fileId": "directus-file-uuid"  // Directus file ID ✅
}
```

## File Upload Flow

### 1. User Uploads PDF to Directus

```typescript
// Via Directus SDK
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('http://directus:8055/files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const { data: { id: fileId } } = await response.json();
// fileId is the Directus file UUID
```

### 2. Create Workflow with File ID

```bash
POST /workflows/pdf
{
  "fileId": "uuid-from-step-1",
  "fileName": "invoice.pdf"
}
```

### 3. PDF Worker Processes

```typescript
// 1. Download from Directus
const pdfBuffer = await directusDocumentService.downloadFile(fileId);

// 2. Split PDF
const pages = await splitPdfWithLibrary(pdfBuffer);

// 3. Upload each page to Directus
for (const page of pages) {
  const uploadedFile = await directusDocumentService.uploadFile({
    filename: `page-${pageNumber}.pdf`,
    buffer: pageBuffer,
    mimetype: "application/pdf",
    title: `Page ${pageNumber}`
  });
  
  // uploadedFile.id is the Directus file ID for this page
  pageFileIds.push(uploadedFile.id);
}
```

### 4. LLM Worker Processes Pages

```typescript
// Download page from Directus
const pageBuffer = await directusDocumentService.downloadFile(pageFileId);

// Process with LLM
const result = await validatePdfContentWithGemini(pageBuffer);

// Store results
await workflowService.updateDocumentPageLlmResult(pageId, result);
```

## Data Types

### Before (MinIO Keys)
```typescript
interface PdfWorkflowJobData {
  fileKey: string;  // "uploads/document.pdf"
  pageFileKey: string;  // "workflows/{id}/pages/page-1.pdf"
}
```

### After (Directus File IDs)
```typescript
interface PdfWorkflowJobData {
  fileId: string;  // "uuid-1234-5678"
  pageFileId: string;  // "uuid-abcd-efgh"
}
```

## Database Schema

Files are referenced by Directus file ID:

```typescript
interface Workflow {
  input_file_key: string;  // Stores Directus file ID
}

interface DocumentPage {
  file_key: string;  // Stores Directus file ID
}
```

**Note:** Field named `file_key` for consistency, but contains Directus file ID, not MinIO key.

## MinIO Client (Optional)

The MinIO client (`src/lib/minio/`) is still available for internal operations if needed, but **should not be used** for normal file operations. All file management goes through Directus.

## Benefits of This Architecture

1. **Single Source of Truth**: Directus tracks all files
2. **Proper Permissions**: Directus file ACL applies
3. **Audit Trail**: File access logged in Directus
4. **Consistency**: All features use same file API
5. **Admin UI**: Files visible in Directus admin panel
6. **Backup**: Directus backup includes file metadata

## Docker Configuration

Workers are configured to access Directus:

```yaml
worker-pdf:
  environment:
    DIRECTUS_URL: http://directus:8055
    DIRECTUS_TOKEN: ${DIRECTUS_API_TOKEN}
    # MinIO config only for Directus internal use
    MINIO_ENDPOINT: minio
```

## Testing

### Upload a File
```bash
# Upload to Directus
curl -X POST http://localhost:8055/files \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"

# Response:
{
  "data": {
    "id": "uuid-1234",  // Use this for workflow
    "filename_disk": "abc123.pdf",
    "storage": "local"
  }
}
```

### Create Workflow
```bash
curl -X POST http://localhost:3001/workflows/pdf \
  -H "Content-Type: application/json" \
  -d '{"fileId": "uuid-1234", "fileName": "document.pdf"}'
```

### Check Results
```bash
curl http://localhost:3001/workflows/uuid-workflow-id
```

## Migration Notes

If you have existing workflows with MinIO keys:

1. Files are likely already in Directus (if uploaded through UI)
2. Find corresponding Directus file ID from `directus_files` table
3. Update `input_file_key` field with Directus file ID
4. Re-run workflow if needed

## Summary

✅ **All file operations go through Directus**
✅ **Use Directus file IDs, not MinIO keys**
✅ **MinIO is internal to Directus**
✅ **Workers download/upload via Directus API**
✅ **Consistent with project architecture**

This ensures proper file management, permissions, and integration with the rest of your Directus-based application.




