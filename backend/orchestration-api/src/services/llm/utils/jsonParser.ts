import { logger } from "../../../utils/logger";

/**
 * Cleans JSON strings by removing markdown code blocks and fixing common formatting issues
 */
export function cleanJsonString(jsonString: string): string {
  return jsonString
    .replace(/```json\s*/g, "") // Remove ```json
    .replace(/```\s*/g, "") // Remove ```
    .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas before closing braces/brackets
    .replace(/,\s*]/g, "]"); // Remove trailing commas before closing brackets
}

/**
 * Extracts JSON from Gemini response text
 * @throws {Error} If no valid JSON is found in the response
 */
export function extractJsonFromResponse(responseContent: string): string {
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
 * Parses and validates JSON string from LLM response
 * @throws {Error} If JSON parsing fails
 */
export function parseJsonResponse(responseContent: string): Record<string, unknown> {
  const jsonString = extractJsonFromResponse(responseContent);
  const cleanedJson = cleanJsonString(jsonString);

  try {
    return JSON.parse(cleanedJson) as Record<string, unknown>;
  } catch (parseError) {
    logger.error("JSON parse error:", parseError);
    logger.error("Attempted to parse:", cleanedJson);
    throw new Error("Failed to parse JSON response from Gemini");
  }
}
