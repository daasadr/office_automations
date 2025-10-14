import { MAX_SHEET_NAME_LENGTH } from "./constants";

/**
 * Creates a safe Excel sheet name by sanitizing the input
 */
export function createSafeSheetName(name: string, existingNames: string[]): string {
  let safeName = name.replace(/[[\]\\/:*?]/g, "_").substring(0, MAX_SHEET_NAME_LENGTH);
  if (safeName === "") safeName = "List1";

  let finalName = safeName;
  let counter = 1;
  while (existingNames.includes(finalName)) {
    finalName = `${safeName}_${counter}`;
    counter++;
  }

  return finalName;
}

/**
 * Generates filename with timestamp
 */
export function generateFilename(jobId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  return `odpady_${jobId}_${timestamp}.xlsx`;
}

/**
 * Converts date string to a format suitable for Excel
 */
export function dateStringToDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // Return the date string as-is for now (Excel will interpret it)
  return String(dateStr).trim();
}

/**
 * Cleans quantity string by extracting numeric value
 */
export function cleanQuantityString(quantityStr: string | null | undefined): string {
  if (!quantityStr) return "";
  const str = String(quantityStr).trim();
  const match = str.match(/^(\d+[.,]?\d*)/);
  if (!match) return "";
  return match[1].replace(".", ",");
}
