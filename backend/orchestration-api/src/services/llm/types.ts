import type { ExtractedData } from "@orchestration-api/services/types";
import type { PromptType } from "./prompts/types";

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
export interface ValidationResult<T = ExtractedData> {
  present_fields: string[];
  missing_fields: string[];
  confidence: number;
  extracted_data: T[];
  provider: "gemini";
  promptType?: PromptType;
  imagePreview?: string;
}

/**
 * Options for document validation
 */
export interface ValidationOptions {
  provider?: "gemini";
  preferPdfNative?: boolean;
  /** The type of prompt to use for validation */
  promptType?: PromptType;
}

// Re-export prompt types for convenience
export type {
  PromptType,
  PromptBuilder,
  PromptConfig,
  BaseExtractedData,
  PromptResult,
} from "./prompts/types";
