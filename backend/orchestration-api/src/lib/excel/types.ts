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
  sheetsNotFound: SheetNotFound[];
}

export interface DuplicateRecord {
  date: string;
  wasteAmount: string;
  sheetName: string;
}

export interface SheetNotFound {
  kodOdpadu: string;
  nazevOdpadu: string;
  odberatelIco: string;
  odberatelNazev: string;
  puvodceIco: string;
  puvodceNazev: string;
  targetSheetName: string;
}

export type { LLMExtractedData };
