import { logger } from "@orchestration-api/utils/logger";
import type { ExtractedData } from "@orchestration-api/services/types";
import type {
  GeminiConfig,
  ValidationResult,
  ValidationOptions,
  PromptType,
} from "@orchestration-api/services/llm/types";
import { parseJsonResponse } from "@orchestration-api/services/llm/utils/jsonParser";
import { getPromptBuilder, getRequiredFields } from "@orchestration-api/services/llm/prompts";
import {
  calculateConfidence,
  validateResponseStructure,
} from "@orchestration-api/services/llm/utils/validation";
import {
  RateLimitedGeminiClient,
  createRateLimitedGeminiClient,
} from "@orchestration-api/services/llm/RateLimitedGeminiClient";
import type { GeminiModel } from "@orchestration-api/lib/rateLimit";
import { config } from "@orchestration-api/config";

// Initialize Gemini configuration from centralized config
const geminiConfig: GeminiConfig = {
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  isConfigured: Boolean(config.gemini.apiKey),
};

if (!geminiConfig.isConfigured) {
  logger.warn("Missing GEMINI_API_KEY environment variable");
}

// Rate-limited Gemini client singleton
const rateLimitedGeminiClient: RateLimitedGeminiClient | null = geminiConfig.isConfigured
  ? createRateLimitedGeminiClient(geminiConfig.apiKey, geminiConfig.model as GeminiModel, {
      maxRetries: config.gemini.rateLimit.maxRetries,
      throwOnRateLimit: true,
      customRateLimit:
        config.gemini.rateLimit.maxRequestsPerMinute > 0
          ? config.gemini.rateLimit.maxRequestsPerMinute
          : undefined,
    })
  : null;

/**
 * Default prompt type if not specified
 */
const DEFAULT_PROMPT_TYPE: PromptType = "waste";

/**
 * Validates PDF content using Gemini API with rate limiting
 * @param pdfBuffer - The PDF file as an ArrayBuffer
 * @param promptType - The type of prompt to use for validation (defaults to "waste")
 * @returns Validation results with present/missing fields and extracted data
 * @throws {Error} If Gemini API is not configured or validation fails
 * @throws {RateLimitError} If rate limit is exceeded and retries are exhausted
 */
export async function validatePdfContentWithGemini(
  pdfBuffer: ArrayBuffer,
  promptType: PromptType = DEFAULT_PROMPT_TYPE
): Promise<ValidationResult> {
  try {
    // Verify Gemini API key is available
    if (!geminiConfig.isConfigured || !rateLimitedGeminiClient) {
      throw new Error(
        "Gemini API key is not configured. Please set GEMINI_API_KEY environment variable."
      );
    }

    logger.info(
      `Sending PDF request to Gemini using model: ${geminiConfig.model}, prompt type: ${promptType}`
    );

    // Convert ArrayBuffer to Uint8Array for Gemini
    const pdfData = new Uint8Array(pdfBuffer);

    // Get the appropriate prompt builder and build the prompt
    const promptBuilder = getPromptBuilder(promptType);
    const prompt = promptBuilder.buildPrompt();
    const requiredFields = promptBuilder.getRequiredFields();

    // Create the content parts
    const parts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: Buffer.from(pdfData).toString("base64"),
        },
      },
    ];

    // Generate content with rate limiting
    const result = await rateLimitedGeminiClient.generateContent(parts);
    const responseContent = result.response.text();

    logger.info("Received response from Gemini");

    if (!responseContent) {
      throw new Error("No response content from Gemini");
    }

    // Parse and validate JSON response
    const parsedResult = parseJsonResponse(responseContent);
    validateResponseStructure(parsedResult);

    // Calculate confidence based on how many fields were found
    const confidence = calculateConfidence(
      parsedResult.present_fields as unknown[],
      requiredFields.length
    );

    // For logistics prompt, return the full parsed result as it has a different structure
    // (invoice_header, transport_line_items, unclaimed_documents instead of extracted_data)
    if (promptType === "logistics") {
      return {
        ...parsedResult,
        confidence: parsedResult.confidence ?? confidence,
        provider: "gemini",
        promptType,
      } as ValidationResult;
    }

    // For other prompts (waste, etc.), use the standard extracted_data structure
    return {
      present_fields: Array.isArray(parsedResult.present_fields)
        ? (parsedResult.present_fields as string[])
        : [],
      missing_fields: Array.isArray(parsedResult.missing_fields)
        ? (parsedResult.missing_fields as string[])
        : [],
      confidence,
      extracted_data: Array.isArray(parsedResult.extracted_data)
        ? (parsedResult.extracted_data as ExtractedData[])
        : [],
      provider: "gemini",
      promptType,
    };
  } catch (error) {
    logger.error("Error validating PDF with Gemini:", error);
    if (error instanceof Error) {
      throw new Error(`Gemini validation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates document content using the specified LLM provider
 * @param input - The document as an ArrayBuffer (PDF)
 * @param options - Validation options including provider selection and prompt type
 * @returns Validation results
 * @throws {Error} If input type is invalid or validation fails
 */
export async function validateDocumentContent(
  input: ArrayBuffer,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const { provider = "gemini", promptType = DEFAULT_PROMPT_TYPE } = options;

  // Only support ArrayBuffer (PDF) input with Gemini
  if (input instanceof ArrayBuffer) {
    if (provider === "gemini") {
      return validatePdfContentWithGemini(input, promptType);
    } else {
      throw new Error("Only Gemini provider is supported for PDF validation.");
    }
  }

  throw new Error("Invalid input type for document validation. Only PDF ArrayBuffer is supported.");
}

/**
 * Get the current rate limit status for Gemini
 * Useful for monitoring and debugging rate limiting behavior
 */
export async function getGeminiRateLimitStatus() {
  if (!rateLimitedGeminiClient) {
    return {
      configured: false,
      model: geminiConfig.model,
      status: null,
    };
  }

  const status = await rateLimitedGeminiClient.getRateLimitStatus();
  const config = rateLimitedGeminiClient.getRateLimitConfig();

  return {
    configured: true,
    model: geminiConfig.model,
    status: {
      ...status,
      maxRequests: config.maxRequests,
      window: config.window,
    },
  };
}

/**
 * Reset the Gemini rate limit counter
 * Use with caution - primarily for testing/debugging
 */
export async function resetGeminiRateLimit(): Promise<void> {
  if (rateLimitedGeminiClient) {
    await rateLimitedGeminiClient.resetRateLimit();
  }
}

// Re-export types for convenience
export type { ValidationResult, ValidationOptions, GeminiConfig, PromptType } from "./types";
export { REQUIRED_FIELDS, WASTE_REQUIRED_FIELDS, LOGISTICS_REQUIRED_FIELDS } from "./constants";

// Re-export prompt utilities
export {
  getPromptBuilder,
  getPrompt,
  getRequiredFields,
  getPromptConfig,
  getAvailablePromptTypes,
  isValidPromptType,
} from "./prompts";

// Re-export rate limiting utilities
export { RateLimitedGeminiClient, createRateLimitedGeminiClient } from "./RateLimitedGeminiClient";
export {
  RateLimitError,
  type RateLimitResult,
  type GeminiModel,
} from "@orchestration-api/lib/rateLimit";
