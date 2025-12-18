import type { PromptType, PromptBuilder, PromptConfig } from "./types";
import { WastePromptBuilder } from "./waste";
import { LogisticsPromptBuilder } from "./logistics";

/**
 * Registry of available prompt builders
 */
const promptBuilderRegistry: Record<PromptType, () => PromptBuilder> = {
  waste: () => new WastePromptBuilder(),
  logistics: () => new LogisticsPromptBuilder(),
};

/**
 * Get a prompt builder for the specified type
 * @param type - The type of prompt to get
 * @returns A prompt builder instance
 * @throws {Error} If the prompt type is not registered
 */
export function getPromptBuilder(type: PromptType): PromptBuilder {
  const factory = promptBuilderRegistry[type];
  if (!factory) {
    throw new Error(
      `Unknown prompt type: ${type}. Available types: ${getAvailablePromptTypes().join(", ")}`
    );
  }
  return factory();
}

/**
 * Get the prompt text for a specific type
 * @param type - The type of prompt to get
 * @returns The built prompt string
 */
export function getPrompt(type: PromptType): string {
  return getPromptBuilder(type).buildPrompt();
}

/**
 * Get required fields for a specific prompt type
 * @param type - The type of prompt
 * @returns Array of required field descriptions
 */
export function getRequiredFields(type: PromptType): readonly string[] {
  return getPromptBuilder(type).getRequiredFields();
}

/**
 * Get the configuration for a specific prompt type
 * @param type - The type of prompt
 * @returns The prompt configuration
 */
export function getPromptConfig(type: PromptType): PromptConfig {
  return getPromptBuilder(type).getConfig();
}

/**
 * Get all available prompt types
 * @returns Array of registered prompt type identifiers
 */
export function getAvailablePromptTypes(): PromptType[] {
  return Object.keys(promptBuilderRegistry) as PromptType[];
}

/**
 * Check if a prompt type is valid
 * @param type - The type to check
 * @returns True if the type is registered
 */
export function isValidPromptType(type: string): type is PromptType {
  return type in promptBuilderRegistry;
}

// Re-export types
export type {
  PromptType,
  PromptBuilder,
  PromptConfig,
  BaseExtractedData,
  PromptResult,
} from "./types";

// Re-export builders
export { WastePromptBuilder, WASTE_REQUIRED_FIELDS } from "./waste";
export { LogisticsPromptBuilder, LOGISTICS_REQUIRED_FIELDS } from "./logistics";
