/**
 * Validates the structure of parsed Gemini response
 * @throws {Error} If the response structure is invalid
 */
export function validateResponseStructure(parsedResult: Record<string, unknown>): void {
  if (
    !parsedResult.present_fields ||
    !parsedResult.missing_fields ||
    !Array.isArray(parsedResult.present_fields) ||
    !Array.isArray(parsedResult.missing_fields)
  ) {
    throw new Error(
      "Invalid response structure from Gemini. Expected present_fields and missing_fields arrays."
    );
  }
}

/**
 * Calculates confidence score based on found fields
 */
export function calculateConfidence(presentFields: unknown[], totalFields: number): number {
  const presentCount = Array.isArray(presentFields) ? presentFields.length : 0;
  return (presentCount / totalFields) * 100;
}
