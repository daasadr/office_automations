/**
 * Type-safe job data contracts for BullMQ queues
 *
 * These types ensure consistency between:
 * - Queue producers (API routes)
 * - Queue consumers (workers)
 * - Database schemas (Directus/Postgres)
 */

import type { Workflow, WorkflowStep, ErpOutbox } from "@orchestration-api/lib/directus/types";

/**
 * Workflow types supported by the system
 */
export type WorkflowType = "pdf_processing" | "email_ingest" | "erp_sync_only";

/**
 * Workflow sources - how the workflow was triggered
 */
export type WorkflowSource = "upload" | "email" | "api" | "manual";

/**
 * Workflow states following the processing lifecycle
 */
export type WorkflowState =
  | "queued"
  | "splitting"
  | "processing"
  | "aggregating"
  | "erp_sync"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Step kinds representing different types of workflow steps
 */
export type WorkflowStepKind = "split_pdf" | "page_llm" | "aggregate" | "erp_save" | "email_parse";

/**
 * Step states following the processing lifecycle
 */
export type WorkflowStepState = "queued" | "running" | "succeeded" | "failed" | "skipped";

/**
 * ERP outbox states
 */
export type ErpOutboxState = "pending" | "in_progress" | "sent" | "failed";

/**
 * ERP operation types
 */
export type ErpOperation = "create_invoice" | "update_vendor" | "link_document";

// ============================================================================
// Job Data Types
// ============================================================================

/**
 * PDF Workflow Job Data
 * Triggered when a new PDF document needs processing
 */
export interface PdfWorkflowJobData {
  /** UUID of the workflow record in Directus */
  workflowId: string;
  /** Directus file ID of the uploaded PDF */
  fileId: string;
  /** Original filename for display/logging */
  fileName?: string;
  /** MIME type of the file */
  mimeType?: string;
  /** Priority for queue ordering (higher = more important) */
  priority?: number;
  /** Optional tenant ID for multi-tenant setups */
  tenantId?: string;
}

/**
 * Page LLM Job Data
 * Triggered for each page that needs LLM processing
 */
export interface PageLlmJobData {
  /** UUID of the parent workflow */
  workflowId: string;
  /** UUID of the workflow step record */
  stepId: string;
  /** UUID of the document page record */
  pageId: string;
  /** Page number (1-based) */
  pageNumber: number;
  /** Directus file ID of the extracted page (PDF) */
  pageFileId: string;
  /** Total pages in the document (for progress tracking) */
  totalPages?: number;
}

/**
 * ERP Sync Job Data
 * Triggered when data needs to be synchronized with the ERP system
 */
export interface ErpSyncJobData {
  /** UUID of the ERP outbox record */
  outboxId: string;
  /** UUID of the related workflow (optional) */
  workflowId?: string;
  /** UUID of the related workflow step (optional) */
  stepId?: string;
  /** Operation to perform */
  operation: ErpOperation;
}

/**
 * Aggregate Results Job Data
 * Triggered after all pages are processed to aggregate results
 */
export interface AggregateResultsJobData {
  /** UUID of the workflow */
  workflowId: string;
  /** Number of pages processed */
  processedPages: number;
  /** Whether to trigger ERP sync after aggregation */
  triggerErpSync?: boolean;
}

// ============================================================================
// Job Result Types
// ============================================================================

/**
 * Result from PDF splitting operation
 */
export interface PdfSplitResult {
  /** Array of extracted pages with their MinIO keys */
  pages: Array<{
    pageNumber: number;
    fileKey: string;
    mimeType: string;
  }>;
  /** Total number of pages extracted */
  totalPages: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Result from LLM page processing
 */
export interface PageLlmResult {
  /** UUID of the page */
  pageId: string;
  /** Extracted data from the page */
  extractedData: Record<string, unknown>;
  /** Confidence score (0-1) */
  confidence: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Model used for processing */
  modelName: string;
}

/**
 * Result from ERP sync operation
 */
export interface ErpSyncResult {
  /** UUID of the outbox record */
  outboxId: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** ERP object ID if created */
  erpObjectId?: string;
  /** ERP object type */
  erpObjectType?: string;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
    externalCode?: string;
  };
}

// ============================================================================
// Job Names (constants for type safety)
// ============================================================================

export const JOB_NAMES = {
  PDF_WORKFLOW: {
    START: "start-pdf-workflow",
    SPLIT_PDF: "split-pdf",
  },
  PAGE_LLM: {
    PROCESS_PAGE: "process-page",
  },
  ERP_SYNC: {
    SYNC_OUTBOX: "sync-outbox-item",
  },
  AGGREGATE: {
    AGGREGATE_RESULTS: "aggregate-results",
  },
} as const;

// ============================================================================
// Queue Names
// ============================================================================

export const QUEUE_NAMES = {
  PDF_WORKFLOW: "pdf-workflow",
  PAGE_LLM: "page-llm",
  ERP_SYNC: "erp-sync",
} as const;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Error detail structure for workflow steps
 */
export interface WorkflowErrorDetail {
  code: string;
  message: string;
  stack?: string;
  externalCode?: string;
}

/**
 * Workflow metadata structure
 */
export interface WorkflowMetadata {
  source?: WorkflowSource;
  tenant?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Step metadata structure
 */
export interface StepMetadata {
  processingTimeMs?: number;
  modelName?: string;
  intermediateResults?: unknown;
  [key: string]: unknown;
}
