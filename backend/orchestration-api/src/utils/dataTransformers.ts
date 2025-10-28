/**
 * Data Transformation Utilities
 *
 * This module consolidates all data transformation, mapping, and conversion logic
 * used across the orchestration API. It provides type-safe utilities for:
 * - Type guards and validation
 * - Data extraction from records
 * - Response data parsing and conversion
 * - Excel-specific transformations
 * - Foundation document formatting
 */

import type { ValidationResult, ExtractedData } from "@orchestration-api/routes/documents/types";
import type { LLMResponseSchema } from "@orchestration-api/llmResponseSchema";
import type { LLMExtractedData } from "@orchestration-api/lib/excel/types";
import type { Response } from "@orchestration-api/lib/directus/types";
import { logger } from "@orchestration-api/utils/logger";
import { MAX_SHEET_NAME_LENGTH } from "@orchestration-api/lib/excel/constants";

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
// Data Extraction Utilities
// ============================================================================

/**
 * Safely get string value from record
 */
export function getStringValue(
  record: Record<string, unknown>,
  key: string,
  defaultValue = ""
): string {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return defaultValue;
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

/**
 * Extract extracted_data from validation result
 * Returns the extracted_data array (always present in ValidationResult)
 */
export function getExtractedData(result: ValidationResult): ExtractedData[] {
  return result.extracted_data;
}

// ============================================================================
// Data Conversion Utilities
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

// ============================================================================
// Response Filtering
// ============================================================================

export const RESPONSE_MAX_AGE_HOURS = 8;
export const RESPONSE_MAX_AGE_MS = RESPONSE_MAX_AGE_HOURS * 60 * 60 * 1000;

// Minimal type for filtering responses by created_at
type FilterableResponse = Pick<Response, "id" | "created_at"> & Partial<Response>;

/**
 * Filter responses to only include recent ones (within 8 hours)
 */
export function filterRecentResponses<T extends FilterableResponse>(responses: T[]): T[] {
  const now = Date.now();
  const cutoffTime = now - RESPONSE_MAX_AGE_MS;

  return responses.filter((response) => {
    if (!response.created_at) return false;
    const responseTime = new Date(response.created_at).getTime();
    const isRecent = responseTime > cutoffTime;

    if (!isRecent) {
      logger.debug("Filtering out old response", {
        responseId: response.id,
        createdAt: response.created_at,
        ageHours: Math.round((now - responseTime) / (60 * 60 * 1000)),
        maxAgeHours: RESPONSE_MAX_AGE_HOURS,
      });
    }

    return isRecent;
  });
}

// ============================================================================
// Excel Transformation Utilities
// ============================================================================

/**
 * Creates a safe Excel sheet name by sanitizing the input
 */
export function createSafeSheetName(name: string, existingNames: string[]): string {
  let safeName = name.replace(/[[\]\\/:*?]/g, "_").substring(0, MAX_SHEET_NAME_LENGTH);
  if (safeName === "") safeName = "List1";

  let finalName = safeName;
  let counter = 1;
  while (existingNames.includes(finalName)) {
    finalName = `${safeName}_${counter}`;
    counter++;
  }

  return finalName;
}

/**
 * Generates filename with timestamp for Excel files
 */
export function generateExcelFilename(jobId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  return `odpady_${jobId}_${timestamp}.xlsx`;
}

/**
 * Converts date string to a format suitable for Excel
 */
export function dateStringToDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // Return the date string as-is for now (Excel will interpret it)
  return String(dateStr).trim();
}

/**
 * Cleans quantity string by extracting numeric value
 * Converts dots to commas for Czech number format
 */
export function cleanQuantityString(quantityStr: string | null | undefined): string {
  if (!quantityStr) return "";
  const str = String(quantityStr).trim();
  const match = str.match(/^(\d+[.,]?\d*)/);
  if (!match) return "";
  return match[1].replace(".", ",");
}

// ============================================================================
// Foundation Document Formatting
// ============================================================================

/**
 * Formats extracted data records for detailed frontend display.
 * Transforms complex LLM extracted data into a structured format
 * suitable for displaying in the UI.
 *
 * @param extractedData - The raw extracted data from LLM
 * @returns Formatted records with sheet names and structured data
 */
export function formatExtractedRecordsDetail(
  extractedData: LLMExtractedData[]
): Record<string, unknown>[] {
  return extractedData.map((extractedItem: LLMExtractedData) => {
    if (!isRecord(extractedItem)) {
      return {};
    }

    const kodOdpadu =
      getStringValue(extractedItem, "kód odpadu") || getStringValue(extractedItem, "kod_odpadu");
    const odberatel = extractedItem.odběratel;
    const odberatelAlt = getRecordValue(extractedItem, "odberatel");

    let odberatelIco = "";
    if (odberatel && typeof odberatel === "object" && "IČO" in odberatel) {
      odberatelIco = String(odberatel.IČO);
    } else if (odberatelAlt) {
      odberatelIco = getStringValue(odberatelAlt, "ico") || getStringValue(odberatelAlt, "IČO");
    }

    const sheetName = `${kodOdpadu} ${odberatelIco}`.trim();

    // Get table data from various possible field names
    const tabulkaValue = extractedItem.tabulka;
    const tabulka =
      (Array.isArray(tabulkaValue) ? tabulkaValue : null) ||
      getArrayValue<Record<string, unknown>>(extractedItem, "tabulka_evidence") ||
      getArrayValue<Record<string, unknown>>(extractedItem, "tabulka_pohybu") ||
      [];

    let odberatelNazev = "";
    if (odberatel && typeof odberatel === "object" && "název" in odberatel) {
      odberatelNazev = String(odberatel.název);
    } else if (odberatelAlt) {
      odberatelNazev = getStringValue(odberatelAlt, "nazev");
    }

    return {
      sheetName,
      kodOdpadu,
      nazevOdpadu:
        getStringValue(extractedItem, "název/druh odpadu") ||
        getStringValue(extractedItem, "nazev_druhu_odpadu"),
      odberatel: {
        ico: odberatelIco,
        nazev: odberatelNazev,
      },
      records: tabulka.map((record) => {
        if (!isRecord(record)) {
          return {};
        }

        return {
          poradoveCislo:
            getNumberValue(record, "pořadové číslo") || getNumberValue(record, "poradove_cislo"),
          datumVzniku:
            getStringValue(record, "datum vzniku") ||
            getStringValue(record, "datum_vzniku") ||
            getStringValue(record, "datum"),
          mnozstviVznikleho:
            getStringValue(record, "množství vzniklého odpadu") ||
            getStringValue(record, "mnozstvi_vznikleho_odpadu"),
          mnozstviPredaneho:
            getStringValue(record, "množství předaného odpadu") ||
            getStringValue(record, "mnozstvi_predaneho_odpadu"),
        };
      }),
    };
  });
}

// ============================================================================
// Timestamp and Filename Generation
// ============================================================================

/**
 * Generates ISO timestamp for filenames (YYYY-MM-DD format)
 */
export function generateTimestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
}

/**
 * Generates a foundation document filename with timestamp
 */
export function generateFoundationFilename(baseTitle: string, timestamp?: string): string {
  const ts = timestamp || generateTimestampForFilename();
  const baseName = baseTitle.replace(/\.[^/.]+$/, "");
  return `${baseName}_augmented_${ts}.xlsx`;
}

/**
 * Generates a foundation document title with timestamp
 */
export function generateFoundationTitle(baseTitle: string, timestamp?: string): string {
  const ts = timestamp || generateTimestampForFilename();
  return `${baseTitle} (Augmented ${ts})`;
}
