/**
 * Excel processing library
 *
 * Provides functionality for:
 * - Generating Excel files from validation results
 * - Augmenting existing Excel files with extracted data
 */

export { generateExcelFile } from "./generator";
export { augmentExcelWithData } from "./augmenter";

export type {
  GenerateExcelInput,
  GenerateExcelResult,
  AugmentExcelResult,
  DuplicateRecord,
  LLMExtractedData,
} from "./types";

export {
  MAX_SHEET_NAME_LENGTH,
  MAX_RECURSION_DEPTH,
  DEFAULT_COLUMN_WIDTH,
  LABEL_COLUMN_WIDTH,
  VALUE_COLUMN_WIDTH,
  EXCEL_COLUMNS,
} from "./constants";

export {
  createSafeSheetName,
  generateFilename,
  dateStringToDate,
  cleanQuantityString,
} from "./utils";
