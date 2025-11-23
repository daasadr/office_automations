import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@orchestration-api/utils/logger";
import type { ExtractedData } from "@orchestration-api/services/types";
import { REQUIRED_FIELDS } from "@orchestration-api/services/llm/constants";
import type {
  GeminiConfig,
  ValidationResult,
  ValidationOptions,
} from "@orchestration-api/services/llm/types";
import { parseJsonResponse } from "@orchestration-api/services/llm/utils/jsonParser";
import { createAnalysisPrompt } from "@orchestration-api/services/llm/utils/prompt";
import {
  calculateConfidence,
  validateResponseStructure,
} from "@orchestration-api/services/llm/utils/validation";

// Initialize Gemini configuration
const geminiConfig: GeminiConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  isConfigured: Boolean(process.env.GEMINI_API_KEY),
};

if (!geminiConfig.isConfigured) {
  logger.warn("Missing GEMINI_API_KEY environment variable");
}

const gemini = geminiConfig.isConfigured ? new GoogleGenerativeAI(geminiConfig.apiKey!) : null;

/**
 * Validates PDF content using Gemini API
 * @param pdfBuffer - The PDF file as an ArrayBuffer
 * @returns Validation results with present/missing fields and extracted data
 * @throws {Error} If Gemini API is not configured or validation fails
 */
export async function validatePdfContentWithGemini(
  pdfBuffer: ArrayBuffer
): Promise<ValidationResult> {
  try {
    // Verify Gemini API key is available
    if (!geminiConfig.isConfigured || !gemini) {
      throw new Error(
        "Gemini API key is not configured. Please set GEMINI_API_KEY environment variable."
      );
    }

    logger.info(`Sending PDF request to Gemini using model: ${geminiConfig.model}`);

    // Get the model
    const model = gemini.getGenerativeModel({ model: geminiConfig.model });

    // Convert ArrayBuffer to Uint8Array for Gemini
    const pdfData = new Uint8Array(pdfBuffer);

    const prompt = createAnalysisPrompt();

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

    // Generate content
    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseContent = response.text();

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
      REQUIRED_FIELDS.length
    );

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
 * @param options - Validation options including provider selection
 * @returns Validation results
 * @throws {Error} If input type is invalid or validation fails
 */
export async function validateDocumentContent(
  input: ArrayBuffer,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const { provider = "gemini" } = options;

  // Only support ArrayBuffer (PDF) input with Gemini
  if (input instanceof ArrayBuffer) {
    if (provider === "gemini") {
      return validatePdfContentWithGemini(input);
    } else {
      throw new Error("Only Gemini provider is supported for PDF validation.");
    }
  }

  throw new Error("Invalid input type for document validation. Only PDF ArrayBuffer is supported.");
}

// Re-export types for convenience
export type { ValidationResult, ValidationOptions, GeminiConfig } from "./types";
export { REQUIRED_FIELDS } from "./constants";
