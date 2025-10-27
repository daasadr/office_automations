/**
 * Centralized Type Definitions for Document Routes
 *
 * This module consolidates all type definitions used across document routes,
 * including request/response types, validation types, and type guards.
 */

import type { Request } from "express";
import type { JobData } from "../../services/JobService";
import type {
  LLMResponseSchema,
  ExtractedData,
  TabulkaRecord,
  Odberatel,
  Puvod,
  SamostatnaProv,
} from "../../llmResponseSchema";

// Re-export types from other modules for convenience
export type { LLMResponseSchema, ExtractedData, TabulkaRecord, Odberatel, Puvod, SamostatnaProv };

export type {
  SourceDocument,
  Response as DirectusResponse,
  GeneratedDocument,
  FoundationDocument,
  DocumentVersion,
} from "../../lib/directus/types";

export type { JobData } from "../../services/JobService";

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
  present: string[];
  missing: string[];
  confidence: number;
  extracted_data: ExtractedData[];
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
  present?: string[];
  missing?: string[];
  confidence?: number;
  extracted_data?: unknown[];
  provider?: string;
  [key: string]: unknown;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid ValidationResult
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    Array.isArray(obj.present) &&
    obj.present.every((item) => typeof item === "string") &&
    Array.isArray(obj.missing) &&
    obj.missing.every((item) => typeof item === "string") &&
    typeof obj.confidence === "number" &&
    Array.isArray(obj.extracted_data)
  );
}

/**
 * Type guard to check if response_json is a valid ValidationResult
 */
export function isDirectusResponseJsonValid(json: unknown): json is ValidationResult {
  return isValidationResult(json);
}

/**
 * Type guard for checking if an object is a record with string keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for checking if value is an array of records
 */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => isRecord(item));
}

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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely parse response_json from Directus Response
 * Returns null if parsing fails or result is invalid
 */
export function parseResponseJson(json: unknown): ValidationResult | null {
  if (!json) {
    return null;
  }

  if (isValidationResult(json)) {
    return json;
  }

  return null;
}

/**
 * Convert ValidationResult to LLMResponseSchema
 * ValidationResult is a subset of LLMResponseSchema, so this is a safe conversion
 */
export function toLLMResponseSchema(result: ValidationResult): LLMResponseSchema {
  return result as unknown as LLMResponseSchema;
}

/**
 * Ensures a ValidationResult has a provider field set
 * Defaults to "gemini" if not present
 */
export function ensureProvider(result: ValidationResult): ValidationResult & { provider: string } {
  return {
    ...result,
    provider: result.provider || "gemini",
  };
}

/**
 * Extract extracted_data from validation result
 * Returns the extracted_data array (always present in ValidationResult)
 */
export function getExtractedData(result: ValidationResult): ExtractedData[] {
  return result.extracted_data;
}

/**
 * Safely get string value from record
 */
export function getStringValue(
  record: Record<string, unknown>,
  key: string,
  defaultValue = ""
): string {
  const value = record[key];
  return typeof value === "string" ? value : defaultValue;
}

/**
 * Safely get number value from record
 */
export function getNumberValue(
  record: Record<string, unknown>,
  key: string,
  defaultValue = 0
): number {
  const value = record[key];
  return typeof value === "number" ? value : defaultValue;
}

/**
 * Safely get record value from record
 */
export function getRecordValue(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

/**
 * Safely get array value from record
 */
export function getArrayValue<T = unknown>(record: Record<string, unknown>, key: string): T[] {
  const value = record[key];
  return Array.isArray(value) ? (value as T[]) : [];
}
