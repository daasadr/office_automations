import * as XLSX from "xlsx";
import { logger } from "../../utils/logger";
import type { ValidationResult } from "../../services/llmService";
import type { ExtractedData } from "../../services/types";
import type { GenerateExcelInput, GenerateExcelResult } from "./types";
import {
  EXCEL_COLUMNS,
  DEFAULT_COLUMN_WIDTH,
  LABEL_COLUMN_WIDTH,
  VALUE_COLUMN_WIDTH,
  MAX_RECURSION_DEPTH,
} from "./constants";
import { createSafeSheetName, generateFilename } from "./utils";

/**
 * Adds object properties as rows to worksheet data
 */
function addObjectToWorksheet(
  obj: any,
  worksheetData: any[],
  title: string,
  indent = "",
  visited = new Set()
): void {
  if (!obj || visited.has(obj)) return;
  visited.add(obj);

  // Add title row
  worksheetData.push({
    A: title,
    B: "",
    C: "",
    D: "",
    E: "",
    F: "",
  });

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      if (Array.isArray(value)) {
        // Skip arrays here, handle them separately
        return;
      } else if (typeof value === "object" && indent.length < MAX_RECURSION_DEPTH) {
        // Handle nested objects
        addObjectToWorksheet(
          value,
          worksheetData,
          `${indent}${key.replace(/_/g, " ")}:`,
          indent + "  ",
          visited
        );
      } else {
        // Handle simple values
        worksheetData.push({
          A: `${indent}${key.replace(/_/g, " ")}:`,
          B: String(value),
          C: "",
          D: "",
          E: "",
          F: "",
        });
      }
    }
  });

  worksheetData.push({}); // Empty row
}

/**
 * Adds arrays as tables to worksheet data
 */
function addArrayAsTable(arr: any[], worksheetData: any[], title: string): void {
  if (!arr || arr.length === 0) return;

  // Add title row
  worksheetData.push({
    A: title,
    B: "",
    C: "",
    D: "",
    E: "",
    F: "",
  });

  // Get all unique keys from all objects in the array
  const allKeys = new Set<string>();
  arr.forEach((item) => {
    if (typeof item === "object" && item !== null) {
      Object.keys(item).forEach((key) => allKeys.add(key));
    }
  });

  const keys = Array.from(allKeys);

  // Add header row with clean column names
  const headerRow: any = {};
  keys.forEach((key, index) => {
    const columnLetter = String.fromCharCode(65 + index);
    headerRow[columnLetter] = key.replace(/_/g, " ");
  });
  worksheetData.push(headerRow);

  // Add data rows
  arr.forEach((rowData) => {
    const dataRow: any = {};
    keys.forEach((key, index) => {
      const columnLetter = String.fromCharCode(65 + index);
      const value = rowData[key];
      dataRow[columnLetter] = value !== null && value !== undefined ? String(value) : "";
    });
    worksheetData.push(dataRow);
  });

  worksheetData.push({}); // Empty row
}

/**
 * Creates a worksheet for a single waste data item
 */
function createWorksheetForItem(
  item: ExtractedData,
  index: number
): { worksheet: any; sheetName: string } {
  const kodOdpadu = item["kód odpadu"] || `Záznam_${index + 1}`;
  const worksheetData: any[] = [];

  // Add basic information (non-array, non-object fields)
  const basicInfo: any = {};
  Object.entries(item).forEach(([key, value]) => {
    if (!Array.isArray(value) && typeof value !== "object") {
      basicInfo[key] = value;
    }
  });

  if (Object.keys(basicInfo).length > 0) {
    addObjectToWorksheet(basicInfo, worksheetData, "INFORMACE O ODPADU", "", new Set());
  }

  // Add nested objects (like původce, odběratel)
  Object.entries(item).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      addObjectToWorksheet(
        value,
        worksheetData,
        key.replace(/_/g, " ").toUpperCase(),
        "",
        new Set()
      );
    }
  });

  // Add arrays as tables
  Object.entries(item).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      addArrayAsTable(value, worksheetData, key.replace(/_/g, " ").toUpperCase());
    }
  });

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(worksheetData, {
    skipHeader: true,
    header: EXCEL_COLUMNS,
  });

  // Set column widths for better readability
  const maxColumns =
    worksheetData.length > 0
      ? Math.max(...worksheetData.map((row) => Object.keys(row).length), 6)
      : 6;

  const columnWidths = Array.from({ length: maxColumns }, (_, i) => {
    if (i === 0) return { wch: LABEL_COLUMN_WIDTH };
    if (i === 1) return { wch: VALUE_COLUMN_WIDTH };
    return { wch: DEFAULT_COLUMN_WIDTH };
  });

  worksheet["!cols"] = columnWidths;

  return { worksheet, sheetName: kodOdpadu };
}

/**
 * Creates a summary sheet when no data is available
 */
function createSummarySheet(validationResult: ValidationResult): any {
  const summaryData = [
    {
      Info: "Žádná data nebyla nalezena v dokumentu",
      "Celkem záznamů": validationResult.extracted_data.length,
      Důvěryhodnost: `${validationResult.confidence.toFixed(1)}%`,
      "Nalezené informace": validationResult.present.join(", "),
      "Chybějící informace": validationResult.missing.join(", "),
    },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet["!cols"] = [
    { wch: LABEL_COLUMN_WIDTH },
    { wch: 15 },
    { wch: 15 },
    { wch: 50 },
    { wch: 50 },
  ];

  return summarySheet;
}

/**
 * Generates an Excel file from validation results
 */
export async function generateExcelFile(input: GenerateExcelInput): Promise<GenerateExcelResult> {
  try {
    logger.info("Starting Excel generation", { jobId: input.jobId });

    const { validationResult } = input;

    if (!validationResult?.extracted_data) {
      throw new Error("No validation result or extracted data provided");
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Process each waste code entry
    validationResult.extracted_data.forEach((item, index) => {
      const { worksheet, sheetName } = createWorksheetForItem(item, index);
      const safeSheetName = createSafeSheetName(sheetName, workbook.SheetNames);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    // If no data was processed, create a summary sheet
    if (validationResult.extracted_data.length === 0) {
      const summarySheet = createSummarySheet(validationResult);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Přehled");
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    });

    const filename = generateFilename(input.jobId);

    logger.info("Excel generation completed successfully", {
      jobId: input.jobId,
      filename,
      bufferSize: excelBuffer.length,
      sheetCount: workbook.SheetNames.length,
    });

    return {
      jobId: input.jobId,
      filename,
      buffer: Buffer.from(excelBuffer),
      success: true,
    };
  } catch (error) {
    logger.error("Excel generation failed", { jobId: input.jobId, error });

    return {
      jobId: input.jobId,
      filename: "",
      buffer: Buffer.alloc(0),
      success: false,
      error: error instanceof Error ? error.message : "Unknown Excel generation error",
    };
  }
}
