import type { ValidationResult } from "../../services/llm";
import type { ExtractedData as LLMExtractedData } from "../../llmResponseSchema";

export interface GenerateExcelInput {
  jobId: string;
  validationResult: ValidationResult;
}

export interface GenerateExcelResult {
  jobId: string;
  filename: string;
  buffer: Buffer;
  success: boolean;
  error?: string;
}

export interface AugmentExcelResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
  sheetsModified: string[];
  duplicatesSkipped: DuplicateRecord[];
  recordsAdded: number;
}

export interface DuplicateRecord {
  date: string;
  wasteAmount: string;
  sheetName: string;
}

export type { LLMExtractedData };
