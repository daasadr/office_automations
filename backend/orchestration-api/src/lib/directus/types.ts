/**
 * Directus Schema Type Definitions
 * Based on the Directus schema snapshot
 */

/**
 * Source Documents Collection
 * Uploaded files that are processed to extract information
 */
export interface SourceDocument {
  id?: string;
  title: string;
  file?: string; // UUID reference to directus_files
  hash_sha256?: string;
  mime_type?: string;
  bytes?: number;
  processing_status?: "uploaded" | "processing" | "completed" | "failed";
  created_at?: string;
  updated_at?: string;
}

/**
 * Workflows Collection
 * Main workflow instances for document processing and queue management
 */
export interface Workflow {
  id?: string;
  state?:
    | "queued"
    | "splitting"
    | "processing"
    | "aggregating"
    | "erp_sync"
    | "completed"
    | "failed"
    | "cancelled";
  type?: "pdf_processing" | "email_ingest" | "erp_sync_only";
  source?: "upload" | "email" | "api" | "manual";
  priority?: number;
  tenant?: string; // UUID reference to companies (optional, for multi-tenant)
  input_file_key?: string; // MinIO key
  input_file_name?: string;
  input_file_mime?: string;
  input_email_message_id?: string; // For email-triggered workflows
  input_email_from?: string;
  input_email_subject?: string;
  total_steps?: number;
  completed_steps?: number;
  started_at?: string;
  finished_at?: string;
  error_summary?: {
    code?: string;
    message?: string;
    last_step_id?: string;
  };
  metadata?: Record<string, unknown>;
  bullmq_job_id?: string; // BullMQ job ID for cross-debugging
  date_created?: string;
  date_updated?: string;
}

/**
 * Workflow Steps Collection
 * Individual steps within workflows for tracking progress
 */
export interface WorkflowStep {
  id?: string;
  workflow?: string; // UUID reference to workflows
  kind?: "split_pdf" | "page_llm" | "aggregate" | "erp_save" | "email_parse";
  key?: string; // Identifies the item: page ID, page number, etc.
  queue?: string; // e.g., 'pdf-workflow', 'page-llm', 'erp-sync'
  state?: "queued" | "running" | "succeeded" | "failed" | "skipped";
  attempts?: number;
  max_attempts?: number;
  job_id?: string; // BullMQ jobId for this step
  page_number?: number; // Useful for PDF processing
  started_at?: string;
  finished_at?: string;
  error_detail?: {
    code?: string;
    message?: string;
    stack?: string;
    externalCode?: string;
  };
  metadata?: Record<string, unknown>;
  date_created?: string;
  date_updated?: string;
}

/**
 * Workflow Step Runs Collection
 * History of retry attempts for workflow steps
 */
export interface WorkflowStepRun {
  id?: string;
  step?: string; // UUID reference to workflow_steps
  attempt?: number;
  state?: "running" | "succeeded" | "failed";
  started_at?: string;
  finished_at?: string;
  error_detail?: {
    code?: string;
    message?: string;
    stack?: string;
    externalCode?: string;
  };
  metadata?: Record<string, unknown>; // LLM latency, ERP response, etc.
  date_created?: string;
  date_updated?: string;
}

/**
 * ERP Outbox Collection
 * Reliable outbox pattern for ERP/IFS integration
 */
export interface ErpOutbox {
  id?: string;
  workflow?: string; // UUID reference to workflows (optional)
  step?: string; // UUID reference to workflow_steps (optional)
  operation?: "create_invoice" | "update_vendor" | "link_document";
  payload?: Record<string, unknown>; // Data to send to IFS
  state?: "pending" | "in_progress" | "sent" | "failed";
  attempts?: number;
  last_error?: {
    code?: string;
    message?: string;
    externalCode?: string;
    stack?: string;
  };
  erp_object_type?: string; // e.g., 'PurchaseOrder', 'Invoice'
  erp_object_id?: string; // IFS object ID returned on success
  scheduled_at?: string;
  sent_at?: string;
  metadata?: Record<string, unknown>;
  date_created?: string;
  date_updated?: string;
}

/**
 * Documents Collection
 * Logical documents processed through workflows
 */
export interface Document {
  id?: string;
  company?: string; // UUID reference to companies (optional)
  workflow?: string; // UUID reference to workflows (primary workflow that created this doc)
  file_key?: string; // MinIO key
  file_name?: string;
  mime_type?: string;
  source?: "upload" | "email" | "api" | "manual";
  metadata?: Record<string, unknown>;
  date_created?: string;
  date_updated?: string;
}

/**
 * Document Pages Collection
 * Individual pages from processed documents with LLM results
 */
export interface DocumentPage {
  id?: string;
  document?: string; // UUID reference to documents
  workflow_step?: string; // UUID reference to workflow_steps (the page_llm step)
  page_number?: number; // 1-based
  file_key?: string; // MinIO key of extracted page
  text?: string; // Extracted OCR/text
  llm_result?: Record<string, unknown>; // Summaries, extractions, classification
  metadata?: Record<string, unknown>;
  date_created?: string;
  date_updated?: string;
}

/**
 * Responses Collection
 * LLM responses for source documents
 */
export interface Response {
  id?: string;
  source_document?: string; // UUID reference to source_documents
  prompt?: string;
  response_text?: string;
  response_json?: Record<string, unknown>;
  model_name?: string;
  token_count?: number;
  processing_time_ms?: number;
  status?: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Generated Documents Collection
 * Documents generated from LLM responses (e.g., Excel files)
 */
export interface GeneratedDocument {
  id?: string;
  response_id?: string; // UUID reference to responses
  file?: string; // UUID reference to directus_files
  document_type?: "excel" | "pdf" | "docx" | "csv" | "json" | "other";
  mime_type?: string;
  bytes?: number;
  generation_status?: "pending" | "generating" | "completed" | "failed";
  generation_params?: Record<string, unknown>;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Foundation Documents Collection
 * Documents that get augmented after processing source documents
 */
export interface FoundationDocument {
  id?: string;
  source_document?: string; // UUID reference to source_documents
  file?: string; // UUID reference to directus_files
  title: string;
  doc_type?: string;
  status?: "draft" | "in_review" | "approved" | "rejected" | "published";
  content_json?: Record<string, unknown>;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Document Versions Collection
 * Versions of foundation documents with approval tracking
 */
export interface DocumentVersion {
  id?: string;
  foundation_document?: string; // UUID reference to foundation_documents
  version_number?: number;
  change_type?:
    | "initial"
    | "augmented"
    | "manual_edit"
    | "ai_enhanced"
    | "validation_fix"
    | "other";
  changes_description?: string;
  content_json?: Record<string, unknown>;
  augmented_by?: string;
  approval_status?: "pending" | "approved" | "rejected" | "auto_approved";
  approved_by?: string; // UUID reference to directus_users
  approved_at?: string;
  is_current?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Directus File Upload Response
 */
export interface DirectusFile {
  id: string;
  storage: string;
  filename_disk: string;
  filename_download: string;
  title: string;
  type: string;
  folder?: string;
  uploaded_by?: string;
  uploaded_on: string;
  modified_by?: string;
  modified_on?: string;
  charset?: string;
  filesize: number;
  width?: number;
  height?: number;
  duration?: number;
  embed?: string;
  description?: string;
  location?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Directus Schema with all collections
 */
export interface DirectusSchema {
  source_documents: SourceDocument[];
  responses: Response[];
  generated_documents: GeneratedDocument[];
  foundation_documents: FoundationDocument[];
  document_versions: DocumentVersion[];
  directus_files: DirectusFile[];
  workflows: Workflow[];
  workflow_steps: WorkflowStep[];
  workflow_step_runs: WorkflowStepRun[];
  erp_outbox: ErpOutbox[];
  documents: Document[];
  document_pages: DocumentPage[];
}
