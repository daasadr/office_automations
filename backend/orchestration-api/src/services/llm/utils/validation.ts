/**
 * Validates the structure of parsed Gemini response
 * @throws {Error} If the response structure is invalid
 */
export function validateResponseStructure(parsedResult: Record<string, unknown>): void {
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
 * Calculates confidence score based on found fields
 */
export function calculateConfidence(presentFields: unknown[], totalFields: number): number {
  const presentCount = Array.isArray(presentFields) ? presentFields.length : 0;
  return (presentCount / totalFields) * 100;
}
