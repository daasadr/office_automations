import type { ExtractedData } from "@orchestration-api/services/types";

/**
 * Configuration for Gemini API
 */
export interface GeminiConfig {
  apiKey: string | undefined;
  model: string;
  isConfigured: boolean;
}

/**
 * Result of PDF validation by LLM
 */
export interface ValidationResult {
  present_fields: string[];
  missing_fields: string[];
  confidence: number;
  extracted_data: ExtractedData[];
  provider: "gemini";
  imagePreview?: string;
}

/**
 * Options for document validation
 */
export interface ValidationOptions {
  provider?: "gemini";
  preferPdfNative?: boolean;
}
