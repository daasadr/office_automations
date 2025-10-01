import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger";
import type { ExtractedData } from "./types";

// Configuration for Gemini API
interface GeminiConfig {
  apiKey: string | undefined;
  model: string;
  isConfigured: boolean;
}

const geminiConfig: GeminiConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  isConfigured: Boolean(process.env.GEMINI_API_KEY),
};

if (!geminiConfig.isConfigured) {
  logger.warn("Missing GEMINI_API_KEY environment variable");
}

const gemini = geminiConfig.isConfigured ? new GoogleGenerativeAI(geminiConfig.apiKey!) : null;

const REQUIRED_FIELDS = [
  "Druh odpadu (katalogové číslo podle vyhlášky č. 8/2021 Sb.)",
  "Kategorie odpadu (O – ostatní, N – nebezpečný)",
  "Množství odpadu (v tunách nebo kg)",
  "Způsob nakládání (přeprava, předání, využití, odstranění)",
  "Datum vzniku nebo převzetí/předání odpadu",
  "Identifikace příjemce/předávající osoby (IČO, název, adresa)",
  "Přepravce odpadu (pokud je jiný než předávající nebo příjemce)",
  "Doklady spojené s odpadem (převodní listy, vážní lístky, smlouvy)",
  "Identifikační čísla zařízení (IČZ), kam byl odpad předán (pokud známé)",
];

export interface ValidationResult {
  present: string[];
  missing: string[];
  confidence: number;
  extracted_data: ExtractedData[];
  provider: "gemini";
  imagePreview?: string;
}

// Helper function to clean JSON strings
function cleanJsonString(jsonString: string): string {
  return jsonString
    .replace(/```json\s*/g, "") // Remove ```json
    .replace(/```\s*/g, "") // Remove ```
    .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas before closing braces/brackets
    .replace(/,\s*]/g, "]"); // Remove trailing commas before closing brackets
}

/**
 * Extracts JSON from Gemini response text
 */
function extractJsonFromResponse(responseContent: string): string {
  // First try to find JSON block with braces
  const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // If no braces found, try to extract from code blocks
  const codeBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  throw new Error("No valid JSON found in Gemini response: " + responseContent);
}

/**
 * Validates the structure of parsed Gemini response
 */
function validateResponseStructure(parsedResult: Record<string, unknown>): void {
  if (
    !parsedResult.present ||
    !parsedResult.missing ||
    !Array.isArray(parsedResult.present) ||
    !Array.isArray(parsedResult.missing)
  ) {
    throw new Error("Invalid response structure from Gemini. Expected present and missing arrays.");
  }
}

/**
 * Creates the prompt for Gemini PDF analysis
 */
function createAnalysisPrompt(): string {
  return `Zkontroluj prosím tento PDF dokument průběžné evidence odpadů a urči, které z následujících informací obsahuje a které chybí.

DŮLEŽITÉ: Analyzuj všechny stránky v dokumentu - informace se mohou nacházet na jakékoli stránce. Dokument může obsahovat tabulky s mnoha řádky dat.

Vyextrahuj z toho dokumentu pro každý kód odpadu (do extracted_data pole vytvoř samostatný objekt):
- kód odpadu (katalogové číslo)
- název/druh odpadu
- kategorie odpadu
- kód způsobu nakládání
- původce - IČO, název, adresa, zodpovědná osoba. pokud možno pak také SAMOSTATNÁ PROVOZOVNA (číslo provozovny, název, adresa, zodpovědná osoba)
- odběratel - IČO, název, adresa
- tabulku se sloupci: pořadové číslo, datum vzniku, množství vznikého odpadu, množství předaného odpadu

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu:
{"present": ["seznam nalezených typů informací"], "missing": ["seznam chybějících typů informací"], "extracted_data": [...]}

Kontrolované typy informací:
${REQUIRED_FIELDS.map((field, index) => `${index + 1}. ${field}`).join("\n")}`;
}

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

    // Extract and parse JSON from response
    const jsonString = extractJsonFromResponse(responseContent);
    const cleanedJson = cleanJsonString(jsonString);

    let parsedResult: Record<string, unknown>;
    try {
      parsedResult = JSON.parse(cleanedJson) as Record<string, unknown>;
    } catch (parseError) {
      logger.error("JSON parse error:", parseError);
      logger.error("Attempted to parse:", cleanedJson);
      throw new Error("Failed to parse JSON response from Gemini");
    }

    // Validate the structure
    validateResponseStructure(parsedResult);

    // Calculate confidence based on how many fields were found
    const confidence =
      ((Array.isArray(parsedResult.present) ? parsedResult.present.length : 0) /
        REQUIRED_FIELDS.length) *
      100;

    return {
      present: Array.isArray(parsedResult.present) ? (parsedResult.present as string[]) : [],
      missing: Array.isArray(parsedResult.missing) ? (parsedResult.missing as string[]) : [],
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

export interface ValidationOptions {
  provider?: "gemini";
  preferPdfNative?: boolean;
}

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
