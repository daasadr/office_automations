/**
 * Centralized Type Definitions for Document Routes
 *
 * This module consolidates all type definitions used across document routes,
 * including request/response types, validation types, and type guards.
 */

import type { Request } from "express";
import type { JobData } from "@orchestration-api/services/JobService";
import type {
  LLMResponseSchema,
  ExtractedWasteData,
  WasteRecord,
  WasteRecipient,
  WasteOriginator,
  IndependentEstablishment,
} from "@orchestration-api/llmResponseSchema";

// Re-export types from other modules for convenience
export type {
  LLMResponseSchema,
  ExtractedWasteData,
  WasteRecord,
  WasteRecipient,
  WasteOriginator,
  IndependentEstablishment,
};

// Legacy type aliases for backward compatibility
export type ExtractedData = ExtractedWasteData;
export type TabulkaRecord = WasteRecord;
export type Odberatel = WasteRecipient;
export type Puvod = WasteOriginator;
export type SamostatnaProv = IndependentEstablishment;

export type {
  SourceDocument,
  Response as DirectusResponse,
  GeneratedDocument,
  FoundationDocument,
  DocumentVersion,
} from "@orchestration-api/lib/directus/types";

export type { JobData } from "@orchestration-api/services/JobService";

// ============================================================================
// Request Extensions
// ============================================================================

/**
 * Extended Request type with job attached by requireJob middleware
 */
export interface RequestWithJob extends Request {
  job: JobData;
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation result returned by LLM processing
 * This interface is compatible with services/llm/types ValidationResult
 */
export interface ValidationResult {
  present_fields: string[];
  missing_fields: string[];
  confidence: number;
  extracted_data: ExtractedWasteData[];
  provider?: string;
}

/**
 * Full validation result with additional metadata
 */
export interface FullValidationResult extends ValidationResult {
  provider: string;
  image_preview?: string;
}

// ============================================================================
// Response JSON Types (from Directus responses)
// ============================================================================

/**
 * Type for response_json field from Directus Response
 */
export interface DirectusResponseJson {
  present_fields?: string[];
  missing_fields?: string[];
  confidence?: number;
  extracted_data?: unknown[];
  provider?: string;
  [key: string]: unknown;
}

// ============================================================================
// Type Guards - Re-exported from dataTransformers
// ============================================================================

export {
  isValidationResult,
  isDirectusResponseJsonValid,
  isRecord,
  isRecordArray,
} from "@orchestration-api/utils/dataTransformers";

// ============================================================================
// Extracted Data Processing Types
// ============================================================================

/**
 * Normalized extracted data record for foundation processing
 */
export interface NormalizedExtractedData {
  kodOdpadu: string;
  nazevDruhuOdpadu: string;
  kategorieOdpadu: string | null;
  kodZpusobuNakladani: string | null;
  puvod: {
    ico: string;
    nazev: string;
    adresa: string;
  };
  odberatel: {
    ico: string;
    nazev: string;
    adresa: string;
  };
  tabulka: NormalizedTabulkaRecord[];
}

/**
 * Normalized table record
 */
export interface NormalizedTabulkaRecord {
  poradoveCislo: number;
  datumVzniku: string;
  mnozstviVzniklehoOdpadu: string | null;
  mnozstviPredanehoOdpadu: string | null;
}

// ============================================================================
// Service Response Types
// ============================================================================

/**
 * Result from document validation service
 */
export interface DocumentValidationResult {
  success: boolean;
  validationResult?: FullValidationResult;
  responseId?: string;
  error?: string;
}

/**
 * Result from Excel generation service
 */
export interface ExcelGenerationResult {
  success: boolean;
  buffer?: Buffer;
  filename?: string;
  generatedDocumentId?: string;
  error?: string;
}

/**
 * Result from foundation processing service
 */
export interface FoundationProcessingResult {
  success: boolean;
  foundationDocument?: {
    id: string;
    title: string;
    status: string;
    basedOn?: {
      id: string;
      title: string;
    };
  };
  processing?: {
    sheetsModified: string[];
    extractedDataCount: number;
    recordsAdded: number;
    duplicatesSkipped: string[];
  };
  error?: string;
}

// ============================================================================
// Request Body Types
// ============================================================================

// Note: ValidatePdfRequestBody is not needed as file is in req.file from multer

/**
 * Request body for generate-excel endpoint
 */
export interface GenerateExcelRequestBody {
  documentId?: string;
  jobId?: string;
}

/**
 * Request body for process-foundation endpoint
 */
export interface ProcessFoundationRequestBody {
  jobId?: string;
  responseId?: string;
  sourceDocumentId?: string;
}

/**
 * Request body for update-foundation-status endpoint
 */
export interface UpdateFoundationStatusRequestBody {
  foundationDocumentId: string;
  status: "approved" | "rejected" | "draft";
}

// ============================================================================
// Route Parameter Types
// ============================================================================

/**
 * URL parameters for status endpoint
 */
export interface StatusParams {
  jobId: string;
}

/**
 * URL parameters for download endpoint
 */
export interface DownloadParams {
  jobId: string;
  filename: string;
}

/**
 * URL parameters for status-by-source endpoint
 */
export interface StatusBySourceParams {
  sourceDocumentId: string;
}

/**
 * URL parameters for download-by-doc endpoint
 */
export interface DownloadByDocParams {
  documentId: string;
  filename: string;
}

/**
 * URL parameters for download-foundation endpoint
 */
export interface DownloadFoundationParams {
  foundationDocumentId: string;
}
