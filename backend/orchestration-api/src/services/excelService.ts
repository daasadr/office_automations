import * as XLSX from "xlsx";
// @ts-ignore - xlsx-populate doesn't have TypeScript definitions
import * as XlsxPopulate from "xlsx-populate";
import { logger } from "../utils/logger";
import type { ValidationResult } from "./llmService";
import type { ExtractedData } from "./types";
import type { ExtractedData as LLMExtractedData } from "../llmResponseSchema";

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

// Constants for Excel generation
const MAX_SHEET_NAME_LENGTH = 31;
const MAX_RECURSION_DEPTH = 20;
const DEFAULT_COLUMN_WIDTH = 20;
const LABEL_COLUMN_WIDTH = 30;
const VALUE_COLUMN_WIDTH = 30;

// Excel column letters for reference
const EXCEL_COLUMNS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

/**
 * Creates a safe Excel sheet name by sanitizing the input
 */
function createSafeSheetName(name: string, existingNames: string[]): string {
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
 * Generates filename with timestamp
 */
function generateFilename(jobId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  return `odpady_${jobId}_${timestamp}.xlsx`;
}

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

/**
 * Augments an existing Excel file with extracted data using xlsx-populate
 * Finds the appropriate sheet and adds records to it with consistent formatting
 */
interface DuplicateRecord {
  date: string;
  wasteAmount: string;
  sheetName: string;
}

export async function augmentExcelWithData(
  excelBuffer: Buffer,
  extractedDataArray: LLMExtractedData[]
): Promise<{
  success: boolean;
  buffer?: Buffer;
  error?: string;
  sheetsModified: string[];
  duplicatesSkipped: DuplicateRecord[];
  recordsAdded: number;
}> {
  try {
    logger.info("Starting Excel augmentation with xlsx-populate", {
      dataCount: extractedDataArray.length,
      bufferSize: excelBuffer.length,
    });

    // Helper functions
    const dateStringToDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return "";
      // Return the date string as-is for now (Excel will interpret it)
      return String(dateStr).trim();
    };

    const cleanQuantityString = (quantityStr: string | null | undefined): string => {
      if (!quantityStr) return "";
      const str = String(quantityStr).trim();
      const match = str.match(/^(\d+[.,]?\d*)/);
      if (!match) return "";
      return match[1].replace(".", ",");
    };

    // Load workbook with xlsx-populate
    const wb = await XlsxPopulate.fromDataAsync(excelBuffer);
    const sheetsModified: string[] = [];
    const duplicatesSkipped: DuplicateRecord[] = [];
    let recordsAdded = 0;

    for (let dataIndex = 0; dataIndex < extractedDataArray.length; dataIndex++) {
      const extractedData = extractedDataArray[dataIndex];

      logger.info("=".repeat(80));
      logger.info(`PROCESSING EXTRACTED DATA ITEM ${dataIndex + 1}/${extractedDataArray.length}`);
      logger.info("=".repeat(80));
      logger.info("Full extracted data structure:", JSON.stringify(extractedData, null, 2));

      // Handle both Czech names and snake_case names
      const kodOdpadu = extractedData["kód odpadu"] || (extractedData as any).kod_odpadu;
      const odberatelIco =
        extractedData.odběratel?.IČO ||
        (extractedData as any).odberatel?.ico ||
        (extractedData as any).odberatel?.IČO ||
        "";
      const targetSheetName = `${kodOdpadu} ${odberatelIco}`.trim();

      logger.info("STEP 1: Searching for sheet", {
        kodOdpadu,
        odberatelIco,
        targetSheetName,
        extractedDataKeys: Object.keys(extractedData),
      });

      // List all available sheets
      const allSheets = wb.sheets();
      const allSheetNames = allSheets.map((s: any) => s.name());
      logger.info("Available sheets in workbook:", { sheetNames: allSheetNames });

      // Find sheet by exact name or by prefix
      let sheet = wb.sheet(targetSheetName);
      if (!sheet) {
        // Try to find by prefix
        logger.info("Exact sheet name not found, trying prefix match...");
        sheet = allSheets.find((s: any) => s.name().startsWith(`${kodOdpadu} ${odberatelIco}`));
        if (sheet) {
          logger.info("Found sheet by prefix match", { matchedSheetName: sheet.name() });
        }
      }

      if (!sheet) {
        logger.warn("❌ Sheet not found, skipping this data item", {
          targetSheetName,
          availableSheets: allSheetNames,
        });
        continue;
      }

      logger.info("✅ STEP 1 COMPLETE: Found matching sheet", { actualSheetName: sheet.name() });

      logger.info("STEP 2: Finding header row and columns");

      // Find header row and columns
      let headerRowNum = -1;
      let colDatum = -1;
      let colMnozVznik = -1;
      let colMnozPred = -1;

      // Scan first 20 rows to find headers
      logger.info("Scanning first 20 rows for header...");
      for (let row = 1; row <= 20; row++) {
        const usedRange = sheet.usedRange();
        if (!usedRange) {
          logger.debug(`Row ${row}: No used range`);
          continue;
        }

        const maxCol = usedRange.endCell().columnNumber();
        logger.debug(`Row ${row}: Scanning ${maxCol} columns`);

        for (let col = 1; col <= maxCol; col++) {
          const cell = sheet.row(row).cell(col);
          const text = String(cell.value() ?? "")
            .toLowerCase()
            .trim();

          if (text) {
            logger.debug(`Row ${row}, Col ${col}: "${text}"`);
          }

          if (text.includes("datum vzniku") || text.includes("datum")) {
            headerRowNum = row;
            colDatum = col;
            logger.info(`Found date column at row ${row}, col ${col}, text: "${text}"`);
          }
          if (
            text.includes("množství vzniklého") ||
            text.includes("mnozstvi vznikleho") ||
            text.includes("mnozstvi vznik") ||
            text.includes("vznikleho") ||
            text.includes("vznikeho") ||
            text.includes("mnozstvi vznik")
          ) {
            colMnozVznik = col;
            logger.info(`Found vzniklého column at col ${col}, text: "${text}"`);
          }
          if (
            text.includes("množství předaného") ||
            text.includes("mnozstvi predaneho") ||
            text.includes("mnozstvi predan") ||
            text.includes("predaneho")
          ) {
            colMnozPred = col;
            logger.info(`Found předaného column at col ${col}, text: "${text}"`);
          }
        }
        if (headerRowNum !== -1) {
          logger.info(`Header row found at row ${headerRowNum}, stopping search`);
          break;
        }
      }

      // Now read the header row data for logging and fallback detection
      const headerRowData: Record<number, string> = {};
      if (headerRowNum > 0) {
        const usedRange = sheet.usedRange();
        const maxCol = usedRange ? usedRange.endCell().columnNumber() : 10;
        for (let col = 1; col <= maxCol; col++) {
          const cell = sheet.row(headerRowNum).cell(col);
          headerRowData[col] = String(cell.value() ?? "")
            .toLowerCase()
            .trim();
        }
      }

      if (headerRowNum === -1 || colDatum === -1) {
        logger.warn("❌ Required columns not found in sheet", {
          sheetName: sheet.name(),
          headerRowNum,
          colDatum,
          colMnozVznik,
          colMnozPred,
        });
        continue;
      }

      logger.info("✅ STEP 2 COMPLETE: Header columns found", {
        headerRowNum,
        colDatum,
        colMnozVznik,
        colMnozPred,
      });

      // Fallback: If we couldn't find the quantity columns, try to find them by looking at all headers
      if (colMnozVznik === -1) {
        // First check if column 3 (C) has "množství" in its header (and not "předaného")
        if (
          headerRowData[3] &&
          headerRowData[3].includes("mnoz") &&
          !headerRowData[3].includes("predan")
        ) {
          colMnozVznik = 3;
          logger.info("Using column C (3) as fallback for množství vzniklého", {
            header: headerRowData[3],
          });
        } else {
          // Look for any column that has "mnoz" and "vznik" in the header
          for (const [colStr, headerText] of Object.entries(headerRowData)) {
            const col = Number.parseInt(colStr);
            if (
              headerText.includes("mnoz") &&
              (headerText.includes("vznik") || headerText.includes("vznik")) &&
              !headerText.includes("predan")
            ) {
              colMnozVznik = col;
              logger.info("Found množství vzniklého column by scanning headers", {
                col,
                header: headerText,
              });
              break;
            }
          }
        }
      }

      // Similar fallback for předaného
      if (colMnozPred === -1) {
        for (const [colStr, headerText] of Object.entries(headerRowData)) {
          const col = Number.parseInt(colStr);
          if (headerText.includes("mnoz") && headerText.includes("predan")) {
            colMnozPred = col;
            logger.info("Found množství předaného column by scanning headers", {
              col,
              header: headerText,
            });
            break;
          }
        }
      }

      logger.info("STEP 3: Finding first empty row");
      logger.info("Header row details", {
        headerRowNum,
        colDatum,
        headerRowDataKeys: Object.keys(headerRowData),
        col1: headerRowData[1],
        col2: headerRowData[2],
        col3: headerRowData[3],
        col4: headerRowData[4],
        col5: headerRowData[5],
      });

      // Find first empty row in the datum vzniku column
      let firstEmptyRowNum = headerRowNum + 1;
      logger.info(`Starting search for empty row from row ${firstEmptyRowNum}`);

      while (firstEmptyRowNum <= 1000) {
        const cell = sheet.row(firstEmptyRowNum).cell(colDatum);
        const val = cell.value();
        logger.debug(`Row ${firstEmptyRowNum}, col ${colDatum} value: ${JSON.stringify(val)}`);

        if (val === undefined || val === null || val === "") {
          logger.info(`Found empty cell at row ${firstEmptyRowNum}`);
          break;
        }
        firstEmptyRowNum++;
      }

      logger.info("✅ STEP 3 COMPLETE: First empty row found", {
        firstEmptyRowNum,
        colDatum,
        rowsScanned: firstEmptyRowNum - headerRowNum - 1,
      });

      // Determine column range
      const usedRange = sheet.usedRange();
      const maxCol = usedRange ? usedRange.endCell().columnNumber() : 10;

      // Detect date format and number format from existing data
      logger.info("STEP 3.5: Detecting existing cell formats");
      let existingDateFormat: string | null = null;
      let existingNumberFormat: string | null = null;

      // Look at the first data row to get formatting
      const firstDataRow = headerRowNum + 1;
      if (firstDataRow < firstEmptyRowNum) {
        try {
          const existingDateCell = sheet.row(firstDataRow).cell(colDatum);
          existingDateFormat = existingDateCell.style("numberFormat");
          logger.info("Detected date format from existing data", {
            format: existingDateFormat,
            sampleValue: existingDateCell.value(),
          });

          // Get number format from quantity column
          const colWasteAmount = colDatum + 1;
          const existingNumberCell = sheet.row(firstDataRow).cell(colWasteAmount);
          existingNumberFormat = existingNumberCell.style("numberFormat");
          logger.info("Detected number format from existing data", {
            format: existingNumberFormat,
            sampleValue: existingNumberCell.value(),
          });
        } catch (error) {
          logger.warn("Could not detect existing formats, will use defaults", { error });
        }
      }

      // Default formats if detection fails
      if (!existingDateFormat) {
        existingDateFormat = "d.m.yyyy"; // Czech date format
        logger.info("Using default date format", { format: existingDateFormat });
      }
      if (!existingNumberFormat) {
        existingNumberFormat = "0.00"; // Number with 2 decimals
        logger.info("Using default number format", { format: existingNumberFormat });
      }

      logger.info("STEP 4: Processing table data");

      // Handle multiple field name variations: "tabulka", "tabulka_evidence", "tabulka_pohybu"
      const tabulka =
        extractedData.tabulka ||
        (extractedData as any).tabulka_evidence ||
        (extractedData as any).tabulka_pohybu ||
        [];

      logger.info("Table data lookup", {
        sheetName: sheet.name(),
        extractedDataKeys: Object.keys(extractedData),
        hasTabulka: !!extractedData.tabulka,
        hasTabulkaEvidence: !!(extractedData as any).tabulka_evidence,
        hasTabulkaPohybu: !!(extractedData as any).tabulka_pohybu,
        foundTableLength: tabulka.length,
      });

      if (tabulka.length === 0) {
        logger.warn("❌ No table data found to add", {
          sheetName: sheet.name(),
          availableKeys: Object.keys(extractedData),
          extractedDataSample: JSON.stringify(extractedData).substring(0, 500),
        });
        continue;
      }

      logger.info(`Found ${tabulka.length} records to process`);
      logger.info("First record structure:", JSON.stringify(tabulka[0], null, 2));

      // Helper function to check if record already exists
      const isDuplicateRecord = (dateValue: any, wasteAmount: any): boolean => {
        // Scan existing rows to find duplicates
        for (let existingRow = headerRowNum + 1; existingRow < firstEmptyRowNum; existingRow++) {
          const existingDateCell = sheet.row(existingRow).cell(colDatum);
          const existingWasteCell = sheet.row(existingRow).cell(colDatum + 1);

          const existingDate = existingDateCell.value();
          const existingWaste = existingWasteCell.value();

          // Compare dates (handle both serial numbers and strings)
          let datesMatch = false;
          if (typeof dateValue === "number" && typeof existingDate === "number") {
            datesMatch = Math.abs(dateValue - existingDate) < 0.01; // Allow small floating point differences
          } else {
            datesMatch = String(dateValue) === String(existingDate);
          }

          // Compare waste amounts (handle both numbers and strings)
          let wastesMatch = false;
          if (typeof wasteAmount === "number" && typeof existingWaste === "number") {
            wastesMatch = Math.abs(wasteAmount - existingWaste) < 0.01; // Allow small floating point differences
          } else {
            const wasteStr = String(wasteAmount).replace(",", ".").trim();
            const existingWasteStr = String(existingWaste).replace(",", ".").trim();
            wastesMatch = wasteStr === existingWasteStr;
          }

          if (datesMatch && wastesMatch) {
            logger.info("Duplicate record found", {
              existingRow,
              date: existingDate,
              wasteAmount: existingWaste,
            });
            return true;
          }
        }
        return false;
      };

      let recordsAddedInThisSheet = 0;
      for (let i = 0; i < tabulka.length; i++) {
        const record = tabulka[i];
        const rowNum = firstEmptyRowNum + recordsAddedInThisSheet;

        logger.info("─".repeat(60));
        logger.info(`STEP 4.${i + 1}: Processing record ${i + 1}/${tabulka.length}`);
        logger.info("Record data:", JSON.stringify(record, null, 2));
        logger.info(`Target row number: ${rowNum}`);

        // Apply black borders to all cells in the row
        logger.info(`Setting borders for row ${rowNum}, columns 1-${maxCol}`);
        for (let col = 1; col <= maxCol; col++) {
          const targetCell = sheet.row(rowNum).cell(col);

          // Set black borders using xlsx-populate's expected format
          targetCell.style({
            border: true,
            borderStyle: "thin",
            borderColor: "000000",
          });

          // Clear background by setting it to white
          try {
            targetCell.style("fill", "FFFFFF");
          } catch {
            // If setting fill fails, just continue without it
            logger.debug("Could not set fill", { col });
          }
        }
        logger.info("Borders set successfully");

        // Now set the actual values
        // Handle both Czech names and snake_case names for fields
        logger.info("Extracting quantity values from record...");
        const pred = cleanQuantityString(
          record["množství předaného odpadu"] || (record as any).mnozstvi_predaneho_odpadu
        );
        let vznik = cleanQuantityString(
          record["množství vzniklého odpadu"] || (record as any).mnozstvi_vznikleho_odpadu
        );

        logger.info("Quantity values extracted", {
          predRaw: record["množství předaného odpadu"] || (record as any).mnozstvi_predaneho_odpadu,
          predCleaned: pred,
          vznikRaw:
            record["množství vzniklého odpadu"] || (record as any).mnozstvi_vznikleho_odpadu,
          vznikCleaned: vznik,
        });

        if (!vznik && pred) {
          vznik = pred;
          logger.info("Using množství předaného for množství vzniklého (original was null)", {
            value: vznik,
          });
        }

        // Date cell - handle multiple field name formats
        logger.info("Extracting date value from record...");
        logger.info("Checking date field variations:", {
          "datum vzniku": record["datum vzniku"],
          datum_vzniku: (record as any).datum_vzniku,
          datum: (record as any).datum,
        });

        const datumVzniku =
          record["datum vzniku"] || (record as any).datum_vzniku || (record as any).datum;
        const datumFormatted = dateStringToDate(datumVzniku);

        logger.info("Date value extracted", {
          datumVzniku,
          datumFormatted,
          recordKeys: Object.keys(record),
        });

        if (!datumVzniku) {
          logger.error("❌ No date value found in record! Cannot write row.", {
            recordKeys: Object.keys(record),
            record: JSON.stringify(record),
          });
          continue; // Skip this record if no date
        }

        // Parse date to check for duplicates
        let dateValueForCheck: any = datumFormatted;
        try {
          const dateParts = datumFormatted.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          if (dateParts) {
            const day = parseInt(dateParts[1], 10);
            const month = parseInt(dateParts[2], 10);
            const year = parseInt(dateParts[3], 10);
            const jsDate = new Date(year, month - 1, day);
            const excelEpoch = new Date(1899, 11, 30);
            const diffTime = jsDate.getTime() - excelEpoch.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            dateValueForCheck = diffDays;
          }
        } catch (error) {
          // Use string comparison as fallback
        }

        // Convert quantity for duplicate check
        let quantityForCheck: any = vznik;
        if (vznik && typeof vznik === "string") {
          const numericValue = parseFloat(vznik.replace(",", "."));
          if (!isNaN(numericValue)) {
            quantityForCheck = numericValue;
          }
        }

        // Check for duplicates before adding
        if (isDuplicateRecord(dateValueForCheck, quantityForCheck)) {
          logger.warn("⚠️ Skipping duplicate record", {
            date: datumFormatted,
            wasteAmount: vznik,
            sheetName: sheet.name(),
          });

          duplicatesSkipped.push({
            date: datumFormatted,
            wasteAmount: vznik || "",
            sheetName: sheet.name(),
          });

          continue; // Skip this duplicate record
        }

        // Write date with proper formatting
        logger.info(`Writing date to cell (row: ${rowNum}, col: ${colDatum})`);
        const dateCell = sheet.row(rowNum).cell(colDatum);

        // Try to parse the date and convert it to Excel serial number
        let dateValue: any = datumFormatted;
        try {
          // Parse Czech date format (D.M.YYYY)
          const dateParts = datumFormatted.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          if (dateParts) {
            const day = parseInt(dateParts[1], 10);
            const month = parseInt(dateParts[2], 10);
            const year = parseInt(dateParts[3], 10);
            const jsDate = new Date(year, month - 1, day);

            // Convert to Excel serial number (days since 1900-01-01)
            const excelEpoch = new Date(1899, 11, 30); // Excel's epoch
            const diffTime = jsDate.getTime() - excelEpoch.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            dateValue = diffDays;

            logger.info("Converted date to Excel serial number", {
              original: datumFormatted,
              parsed: `${year}-${month}-${day}`,
              serialNumber: dateValue,
            });
          }
        } catch (error) {
          logger.warn("Could not parse date, using as string", { date: datumFormatted, error });
        }

        dateCell.value(dateValue);
        dateCell.style({
          numberFormat: existingDateFormat,
          horizontalAlignment: "right",
        });
        logger.info("✅ Date written successfully", {
          rowNum,
          col: colDatum,
          value: dateValue,
          format: existingDateFormat,
        });

        // Waste amount goes in the cell immediately to the right of the date
        const colWasteAmount = colDatum + 1;
        logger.info(`Writing waste amount to cell (row: ${rowNum}, col: ${colWasteAmount})`);
        const quantityCell = sheet.row(rowNum).cell(colWasteAmount);

        // Convert string quantity to number (replace comma with dot)
        let quantityValue: any = vznik;
        if (vznik && typeof vznik === "string") {
          const numericValue = parseFloat(vznik.replace(",", "."));
          if (!isNaN(numericValue)) {
            quantityValue = numericValue;
            logger.info("Converted quantity to number", {
              original: vznik,
              numeric: quantityValue,
            });
          }
        }

        quantityCell.value(quantityValue);
        quantityCell.style({
          numberFormat: existingNumberFormat,
          horizontalAlignment: "right",
        });
        logger.info("✅ Waste amount written successfully", {
          rowNum,
          col: colWasteAmount,
          value: quantityValue,
          format: existingNumberFormat,
        });

        logger.info("✅ Record added to row successfully", {
          rowNumber: rowNum,
          datumVzniku: datumFormatted,
          wasteAmount: vznik,
          colDatum,
          colWasteAmount,
        });

        recordsAddedInThisSheet++;
        recordsAdded++;
      }

      logger.info("✅ STEP 4 COMPLETE: All records processed", {
        recordsProcessed: tabulka.length,
        recordsAdded: recordsAddedInThisSheet,
        duplicatesSkipped: tabulka.length - recordsAddedInThisSheet,
        startRow: firstEmptyRowNum,
        endRow: firstEmptyRowNum + recordsAddedInThisSheet - 1,
      });

      if (recordsAddedInThisSheet > 0) {
        sheetsModified.push(sheet.name());
      }
    }

    // Write back to buffer
    logger.info("STEP 5: Writing modified workbook back to buffer");
    const outBuffer = await wb.outputAsync();

    logger.info("=".repeat(80));
    logger.info("✅ Excel augmentation completed successfully", {
      sheetsModified,
      bufferSize: outBuffer.length,
      totalDataItemsProcessed: extractedDataArray.length,
      recordsAdded,
      duplicatesSkipped: duplicatesSkipped.length,
    });
    logger.info("=".repeat(80));

    return {
      success: true,
      buffer: outBuffer,
      sheetsModified,
      duplicatesSkipped,
      recordsAdded,
    };
  } catch (error) {
    // Comprehensive error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      name: error instanceof Error ? error.name : undefined,
    };

    logger.error("Excel augmentation failed", errorDetails);
    console.error("Full error object:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error) || "Unknown Excel augmentation error",
      sheetsModified: [],
      duplicatesSkipped: [],
      recordsAdded: 0,
    };
  }
}
