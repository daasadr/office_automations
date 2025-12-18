/**
 * Base interface for all prompt configurations
 */
export interface PromptConfig {
  /** Unique identifier for the prompt type */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this prompt does */
  description: string;
  /** Required fields that the LLM should look for */
  requiredFields: readonly string[];
  /** The prompt template */
  template: string;
}

/**
 * Available prompt types in the system
 */
export type PromptType = "waste" | "logistics";

/**
 * Generic extracted data - base type that specific prompts can extend
 * Intentionally permissive to allow any object structure
 */
// biome-ignore lint/suspicious/noExplicitAny: Needs to be permissive for different prompt types
export type BaseExtractedData = any;

/**
 * Result structure that all prompts should return
 */
export interface PromptResult<T = BaseExtractedData> {
  present_fields: string[];
  missing_fields: string[];
  confidence: number;
  extracted_data: T[];
}

/**
 * Interface for prompt builders
 */
export interface PromptBuilder {
  /** Get the prompt configuration */
  getConfig(): PromptConfig;
  /** Build the full prompt text */
  buildPrompt(): string;
  /** Get required fields for validation */
  getRequiredFields(): readonly string[];
}
