import { createWorkerLogger } from '../shared/logger';
import { config } from '../shared/config';
import { createDirectus, rest, staticToken, uploadFiles, readFiles, readItem, createItem, updateItem } from '@directus/sdk';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

const logger = createWorkerLogger('directus-storage');

// Directus schema interfaces matching the schema snapshot
interface Document {
  id: string;
  title: string;
  source: 'upload' | 'email' | 'api';
  file?: string; // FK to directus_files
  hash_sha256: string;
  mime_type: string;
  bytes: number;
  doc_type?: string;
  schema_version?: string;
  status: 'received' | 'processing' | 'needs_review' | 'approved' | 'exported' | 'delivered' | 'failed';
  priority: number;
  notes?: string;
  metadata_json?: any;
  date_created?: string;
  date_updated?: string;
}

interface Artifact {
  id: string;
  document: string; // FK to documents
  kind: string; // 'image', 'text', 'preview', etc.
  file: string; // FK to directus_files
  page_no?: number;
  format: string; // 'webp', 'png', 'json', etc.
  hash_sha256: string;
  metadata_json?: any;
}

interface ExtractionJob {
  id: string;
  document: string; // FK to documents
  workflow_id: string;
  run_id: string;
  state: string;
  step: string;
  timings_json?: any;
  costs_json?: any;
  error_json?: any;
  attempt: number;
}

interface Extraction {
  id: string;
  document: string; // FK to documents
  schema_key: string;
  schema_version: string;
  confidence_score?: number;
  extracted_data_json: any;
  validation_status?: 'pending' | 'valid' | 'invalid' | 'needs_review';
  validation_notes?: string;
}

interface DirectusFile {
  id: string;
  storage: string;
  filename_disk: string | null;
  filename_download: string;
  title: string | null;
  type: string | null;
  [key: string]: any;
}

interface DirectusSchema {
  documents: Document;
  artifacts: Artifact;
  extraction_jobs: ExtractionJob;
  extractions: Extraction;
  directus_files: DirectusFile;
}

// Initialize Directus client
const directus = createDirectus<DirectusSchema>(config.directus.url)
  .with(rest())
  .with(staticToken(config.directus.apiToken));

export interface StoreDocumentInput {
  jobId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
  source: 'upload' | 'email' | 'api';
  workflowId?: string;
  title?: string;
}

export interface StoreDocumentResult {
  success: boolean;
  documentId?: string;
  fileId?: string;
  hash?: string;
  error?: string;
}

export interface StoreArtifactInput {
  documentId: string;
  kind: 'image' | 'preview' | 'text' | 'result';
  fileBuffer: Buffer;
  format: string;
  contentType: string;
  pageNo?: number;
  metadata?: any;
}

export interface StoreArtifactResult {
  success: boolean;
  artifactId?: string;
  fileId?: string;
  error?: string;
}

export interface UpdateDocumentStatusInput {
  documentId: string;
  status: Document['status'];
  notes?: string;
  metadata?: any;
}

export interface CreateExtractionJobInput {
  documentId: string;
  workflowId: string;
  runId: string;
  state: string;
  step: string;
}

export interface StoreExtractionResultInput {
  documentId: string;
  schemaKey: string;
  schemaVersion: string;
  extractedData: any;
  confidenceScore?: number;
  validationStatus?: Extraction['validation_status'];
}

/**
 * Store original document file in Directus
 */
export async function storeDocument(input: StoreDocumentInput): Promise<StoreDocumentResult> {
  logger.info('Storing document in Directus', {
    jobId: input.jobId,
    fileName: input.fileName,
    fileSize: input.fileBuffer.length,
    contentType: input.contentType,
    source: input.source
  });

  try {
    // Calculate file hash
    const hash = createHash('sha256').update(input.fileBuffer).digest('hex');
    
    // Check if file with this hash already exists
    const existingFiles = await directus.request(
      readFiles({
        filter: { filename_download: { _eq: input.fileName } }
      })
    );

    if (existingFiles.length > 0) {
      logger.info('File with same name already exists', {
        jobId: input.jobId,
        fileName: input.fileName,
        existingFileId: existingFiles[0].id
      });
      
      // Still create a new document record even if file exists
    }

    // Upload file to Directus
    const formData = new FormData();
    const blob = new Blob([input.fileBuffer], { type: input.contentType });
    formData.append('file', blob, input.fileName);
    formData.append('title', input.title || input.fileName);

    const uploadResult = await directus.request(uploadFiles(formData));
    const fileId = uploadResult.id;

    logger.info('File uploaded to Directus', {
      jobId: input.jobId,
      fileId,
      fileName: input.fileName
    });

    // Create document record
    const documentId = randomUUID();
    const document: Partial<Document> = {
      id: documentId,
      title: input.title || input.fileName,
      source: input.source,
      file: fileId,
      hash_sha256: hash,
      mime_type: input.contentType,
      bytes: input.fileBuffer.length,
      status: 'received',
      priority: 0,
      metadata_json: {
        jobId: input.jobId,
        workflowId: input.workflowId,
        originalFileName: input.fileName,
        uploadedAt: new Date().toISOString()
      }
    };

    await directus.request(createItem('documents', document));

    logger.info('Document record created', {
      jobId: input.jobId,
      documentId,
      fileId
    });

    return {
      success: true,
      documentId,
      fileId,
      hash
    };

  } catch (error) {
    logger.error('Failed to store document in Directus', {
      jobId: input.jobId,
      error
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Store processed artifact (images, previews, etc.)
 */
export async function storeArtifact(input: StoreArtifactInput): Promise<StoreArtifactResult> {
  logger.info('Storing artifact in Directus', {
    documentId: input.documentId,
    kind: input.kind,
    format: input.format,
    fileSize: input.fileBuffer.length,
    pageNo: input.pageNo
  });

  try {
    // Calculate file hash
    const hash = createHash('sha256').update(input.fileBuffer).digest('hex');
    
    // Generate filename for artifact
    const fileName = `${input.kind}_${input.documentId}${input.pageNo ? `_page${input.pageNo}` : ''}.${input.format}`;

    // Upload artifact file to Directus
    const formData = new FormData();
    const blob = new Blob([input.fileBuffer], { type: input.contentType });
    formData.append('file', blob, fileName);
    formData.append('title', fileName);

    const uploadResult = await directus.request(uploadFiles(formData));
    const fileId = uploadResult.id;

    logger.info('Artifact file uploaded to Directus', {
      documentId: input.documentId,
      fileId,
      fileName
    });

    // Create artifact record
    const artifactId = randomUUID();
    const artifact: Partial<Artifact> = {
      id: artifactId,
      document: input.documentId,
      kind: input.kind,
      file: fileId,
      page_no: input.pageNo,
      format: input.format,
      hash_sha256: hash,
      metadata_json: {
        ...input.metadata,
        originalSize: input.fileBuffer.length,
        createdAt: new Date().toISOString()
      }
    };

    await directus.request(createItem('artifacts', artifact));

    logger.info('Artifact record created', {
      documentId: input.documentId,
      artifactId,
      kind: input.kind
    });

    return {
      success: true,
      artifactId,
      fileId
    };

  } catch (error) {
    logger.error('Failed to store artifact in Directus', {
      documentId: input.documentId,
      error
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update document status and metadata
 */
export async function updateDocumentStatus(input: UpdateDocumentStatusInput): Promise<{ success: boolean; error?: string }> {
  logger.info('Updating document status', {
    documentId: input.documentId,
    status: input.status
  });

  try {
    const updateData: Partial<Document> = {
      status: input.status,
      date_updated: new Date().toISOString()
    };

    if (input.notes) {
      updateData.notes = input.notes;
    }

    if (input.metadata) {
      // Merge with existing metadata
      const existingDoc: any = await directus.request((readItem as any)('documents', input.documentId));
      updateData.metadata_json = {
        ...(existingDoc?.metadata_json || {}),
        ...input.metadata,
        lastStatusUpdate: new Date().toISOString()
      };
    }

    await directus.request(updateItem('documents', input.documentId, updateData));

    logger.info('Document status updated successfully', {
      documentId: input.documentId,
      status: input.status
    });

    return { success: true };

  } catch (error) {
    logger.error('Failed to update document status', {
      documentId: input.documentId,
      error
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create extraction job record for workflow tracking
 */
export async function createExtractionJob(input: CreateExtractionJobInput): Promise<{ success: boolean; jobId?: string; error?: string }> {
  logger.info('Creating extraction job record', {
    documentId: input.documentId,
    workflowId: input.workflowId,
    state: input.state
  });

  try {
    const jobId = randomUUID();
    const job: Partial<ExtractionJob> = {
      id: jobId,
      document: input.documentId,
      workflow_id: input.workflowId,
      run_id: input.runId,
      state: input.state,
      step: input.step,
      attempt: 1
    };

    await directus.request(createItem('extraction_jobs', job));

    logger.info('Extraction job record created', {
      documentId: input.documentId,
      jobId,
      workflowId: input.workflowId
    });

    return { success: true, jobId };

  } catch (error) {
    logger.error('Failed to create extraction job', {
      documentId: input.documentId,
      error
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Store LLM extraction results
 */
export async function storeExtractionResult(input: StoreExtractionResultInput): Promise<{ success: boolean; extractionId?: string; error?: string }> {
  logger.info('Storing extraction result', {
    documentId: input.documentId,
    schemaKey: input.schemaKey,
    confidenceScore: input.confidenceScore
  });

  try {
    const extractionId = randomUUID();
    const extraction: Partial<Extraction> = {
      id: extractionId,
      document: input.documentId,
      schema_key: input.schemaKey,
      schema_version: input.schemaVersion,
      confidence_score: input.confidenceScore,
      extracted_data_json: input.extractedData,
      validation_status: input.validationStatus || 'pending'
    };

    await directus.request(createItem('extractions', extraction));

    logger.info('Extraction result stored', {
      documentId: input.documentId,
      extractionId,
      schemaKey: input.schemaKey
    });

    return { success: true, extractionId };

  } catch (error) {
    logger.error('Failed to store extraction result', {
      documentId: input.documentId,
      error
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get document with all related data
 */
export async function getDocumentWithRelations(documentId: string) {
  try {
    const document = await directus.request(
      (readItem as any)('documents', documentId, {
        fields: ['*', 'file.*', 'artifacts.*', 'extraction_jobs.*', 'extractions.*']
      })
    );

    return { success: true, document };
  } catch (error) {
    logger.error('Failed to get document with relations', { documentId, error });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

