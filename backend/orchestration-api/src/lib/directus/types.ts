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
  title: string;
  doc_type?: string;
  status?: "draft" | "in_review" | "approved" | "published";
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
}
