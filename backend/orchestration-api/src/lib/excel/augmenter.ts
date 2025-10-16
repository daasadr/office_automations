// @ts-ignore - xlsx-populate doesn't have TypeScript definitions
import * as XlsxPopulate from "xlsx-populate";
import { logger } from "../../utils/logger";
import type { LLMExtractedData, AugmentExcelResult, DuplicateRecord, SheetNotFound } from "./types";
import { dateStringToDate, cleanQuantityString } from "./utils";

/**
 * Augments an existing Excel file with extracted data using xlsx-populate
 * Finds the appropriate sheet and adds records to it with consistent formatting
 */
export async function augmentExcelWithData(
  excelBuffer: Buffer,
  extractedDataArray: LLMExtractedData[]
): Promise<AugmentExcelResult> {
  try {
    logger.info("Starting Excel augmentation with xlsx-populate", {
      dataCount: extractedDataArray.length,
      bufferSize: excelBuffer.length,
    });

    // Load workbook with xlsx-populate
    const wb = await XlsxPopulate.fromDataAsync(excelBuffer);
    const sheetsModified: string[] = [];
    const duplicatesSkipped: DuplicateRecord[] = [];
    const sheetsNotFound: SheetNotFound[] = [];
    let recordsAdded = 0;

    for (let dataIndex = 0; dataIndex < extractedDataArray.length; dataIndex++) {
      const extractedData = extractedDataArray[dataIndex];

      logger.info("=".repeat(80));
      logger.info(`PROCESSING EXTRACTED DATA ITEM ${dataIndex + 1}/${extractedDataArray.length}`);
      logger.info("=".repeat(80));
      logger.info("Full extracted data structure:", JSON.stringify(extractedData, null, 2));

      // Handle both Czech names and snake_case names
      const kodOdpadu = extractedData["kód odpadu"] || (extractedData as any).kod_odpadu;

      // Helper function to extract all potential IČO numbers from the data
      const extractAllPotentialIcos = (
        obj: any,
        foundIcos: Set<string> = new Set()
      ): Set<string> => {
        if (!obj || typeof obj !== "object") return foundIcos;

        for (const [key, value] of Object.entries(obj)) {
          const keyLower = key.toLowerCase();

          // Check if this is an ICO field
          if ((keyLower.includes("ico") || keyLower === "ičo") && typeof value === "string") {
            // Clean up the IČO - remove dots, spaces, and ellipsis
            const cleaned = value.replace(/\./g, "").replace(/\s/g, "").replace(/…/g, "");

            // Extract 8-digit numbers (Czech IČO format)
            const matches = cleaned.match(/\d{8}/g);
            if (matches) {
              matches.forEach((ico) => foundIcos.add(ico));
            }

            // Also try the cleaned value itself if it looks like an IČO
            if (/^\d{6,8}$/.test(cleaned)) {
              foundIcos.add(cleaned.padStart(8, "0"));
            }
          }

          // Also search for 8-digit numbers in any string value (addresses, names, etc.)
          if (typeof value === "string") {
            const allEightDigits = value.match(/\d{8}/g);
            if (allEightDigits) {
              allEightDigits.forEach((ico) => {
                // Validate it looks like a Czech IČO (starts with non-zero, reasonable range)
                if (ico[0] !== "0" && parseInt(ico) >= 10000000 && parseInt(ico) <= 99999999) {
                  foundIcos.add(ico);
                }
              });
            }
          }

          // Recursively search nested objects
          if (typeof value === "object") {
            extractAllPotentialIcos(value, foundIcos);
          }
        }

        return foundIcos;
      };

      // Extract primary IČO values
      const odberatelIco =
        extractedData.odběratel?.IČO ||
        (extractedData as any).odberatel?.ico ||
        (extractedData as any).odberatel?.IČO ||
        "";

      const puvod =
        extractedData.původce || (extractedData as any).puvod || (extractedData as any).původce;
      const puvodceIco = puvod?.IČO || (puvod as any)?.ico || (puvod as any)?.IČO || "";

      // Extract all potential IČO numbers from the entire data structure
      const allPotentialIcos = extractAllPotentialIcos(extractedData);

      // Remove truncated or incomplete IČOs from the set
      const cleanOdberatel = odberatelIco.replace(/\./g, "").replace(/…/g, "").replace(/\s/g, "");
      const cleanPuvodce = puvodceIco.replace(/\./g, "").replace(/…/g, "").replace(/\s/g, "");

      // Create target sheet name variations to try
      // Priority order: 1) odběratel, 2) původce, 3) any other IČO found
      const targetVariations: Array<{ ico: string; source: string }> = [];

      // Add odběratel if it's complete
      if (cleanOdberatel && cleanOdberatel.length >= 6 && !/…/.test(odberatelIco)) {
        targetVariations.push({ ico: cleanOdberatel, source: "odběratel" });
        allPotentialIcos.delete(cleanOdberatel); // Remove to avoid duplicates
      }

      // Add původce if it's complete
      if (cleanPuvodce && cleanPuvodce.length >= 6 && !/…/.test(puvodceIco)) {
        targetVariations.push({ ico: cleanPuvodce, source: "původce" });
        allPotentialIcos.delete(cleanPuvodce); // Remove to avoid duplicates
      }

      // Add any other complete IČO numbers found in the data
      allPotentialIcos.forEach((ico) => {
        if (ico.length === 8) {
          targetVariations.push({ ico, source: "discovered" });
        }
      });

      logger.info("STEP 1: Searching for sheet", {
        kodOdpadu,
        odberatelIco,
        puvodceIco,
        allDiscoveredIcos: Array.from(allPotentialIcos),
        targetVariations: targetVariations.map((v) => `${kodOdpadu} ${v.ico} (${v.source})`),
        extractedDataKeys: Object.keys(extractedData),
      });

      // Helper function to normalize sheet names (handle multiple spaces, leading/trailing spaces)
      const normalizeSheetName = (name: string): string => {
        return name.trim().replace(/\s+/g, " "); // Replace multiple spaces with single space
      };

      // Helper function to try finding a sheet with a specific IČO
      const tryFindSheet = (ico: string): any => {
        const targetSheetName = `${kodOdpadu} ${ico}`.trim();
        const normalizedTarget = normalizeSheetName(targetSheetName);

        // Try exact match first
        let foundSheet = wb.sheet(targetSheetName);
        if (foundSheet) {
          logger.info("Found sheet by exact match", { sheetName: targetSheetName });
          return foundSheet;
        }

        // Try normalized match
        foundSheet = allSheets.find((s: any) => {
          const sheetName = s.name();
          const normalizedSheetName = normalizeSheetName(sheetName);

          // Check if normalized names match exactly
          if (normalizedSheetName === normalizedTarget) {
            logger.info("Found sheet by normalized exact match", {
              originalSheetName: sheetName,
              normalizedSheetName,
              normalizedTarget,
            });
            return true;
          }

          // Check if normalized sheet name starts with normalized target
          if (normalizedSheetName.startsWith(normalizedTarget)) {
            logger.info("Found sheet by normalized prefix match", {
              originalSheetName: sheetName,
              normalizedSheetName,
              normalizedTarget,
            });
            return true;
          }

          return false;
        });

        return foundSheet;
      };

      // List all available sheets
      const allSheets = wb.sheets();
      const allSheetNames = allSheets.map((s: any) => s.name());
      logger.info("Available sheets in workbook:", {
        sheetNames: allSheetNames,
      });

      // Try to find sheet using different IČO variations
      let sheet: any = null;
      let matchedIco = "";
      let matchedSource = "";

      for (const variation of targetVariations) {
        logger.info(`Trying to find sheet with ${variation.source} IČO: ${variation.ico}`);
        sheet = tryFindSheet(variation.ico);
        if (sheet) {
          matchedIco = variation.ico;
          matchedSource = variation.source;
          logger.info(`✅ Found sheet using ${variation.source} IČO`, {
            sheetName: sheet.name(),
            ico: variation.ico,
          });
          break;
        }
      }

      if (!sheet) {
        const attemptedNames = targetVariations.map((v) => `${kodOdpadu} ${v.ico}`).join(", ");
        logger.warn("❌ Sheet not found, skipping this data item", {
          attemptedNames,
          availableSheets: allSheetNames,
        });

        // Track sheets not found for user notification
        const odberatelNazev =
          extractedData.odběratel?.název || (extractedData as any).odberatel?.nazev || "";
        const puvodceNazev = puvod?.název || (puvod as any)?.nazev || "";

        sheetsNotFound.push({
          kodOdpadu,
          nazevOdpadu:
            extractedData["název/druh odpadu"] || (extractedData as any).nazev_druhu_odpadu || "",
          odberatelIco,
          odberatelNazev: odberatelNazev,
          puvodceIco,
          puvodceNazev: puvodceNazev,
          targetSheetName: attemptedNames,
        });

        continue;
      }

      logger.info("✅ STEP 1 COMPLETE: Found matching sheet", {
        actualSheetName: sheet.name(),
        matchedUsing: matchedSource,
        matchedIco,
      });

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
          // Support multiple date formats: D.M.YYYY, D/M/YYYY, M/D/YY, D.M.YY, etc.
          const dateParts = datumFormatted.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
          if (dateParts) {
            let day: number, month: number, year: number;

            // Parse year and handle 2-digit years
            let parsedYear = parseInt(dateParts[3], 10);
            if (parsedYear < 100) {
              // 2-digit year: assume 2000s for 00-49, 1900s for 50-99
              parsedYear += parsedYear < 50 ? 2000 : 1900;
            }

            // Try to determine if it's M/D/Y or D/M/Y format
            // If separator is slash, assume American format (M/D/Y)
            // If separator is dot, assume European format (D.M.Y)
            const separator = datumFormatted.includes("/") ? "/" : ".";
            const firstNum = parseInt(dateParts[1], 10);
            const secondNum = parseInt(dateParts[2], 10);

            if (separator === "/" && firstNum <= 12) {
              // American format: M/D/Y
              month = firstNum;
              day = secondNum;
              year = parsedYear;
            } else {
              // European format: D.M.Y or D/M/Y
              day = firstNum;
              month = secondNum;
              year = parsedYear;
            }

            const jsDate = new Date(year, month - 1, day);
            const excelEpoch = new Date(1899, 11, 30);
            const diffTime = jsDate.getTime() - excelEpoch.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            dateValueForCheck = diffDays;

            logger.info("Parsed date for duplicate check", {
              original: datumFormatted,
              parsed: `${year}-${month}-${day}`,
              excelSerial: dateValueForCheck,
            });
          }
        } catch (error) {
          logger.warn("Could not parse date for duplicate check, using string comparison", {
            date: datumFormatted,
            error,
          });
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
          // Support multiple date formats: D.M.YYYY, D/M/YYYY, M/D/YY, D.M.YY, etc.
          const dateParts = datumFormatted.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
          if (dateParts) {
            let day: number, month: number, year: number;

            // Parse year and handle 2-digit years
            let parsedYear = parseInt(dateParts[3], 10);
            if (parsedYear < 100) {
              // 2-digit year: assume 2000s for 00-49, 1900s for 50-99
              parsedYear += parsedYear < 50 ? 2000 : 1900;
            }

            // Try to determine if it's M/D/Y or D/M/Y format
            // If separator is slash, assume American format (M/D/Y)
            // If separator is dot, assume European format (D.M.Y)
            const separator = datumFormatted.includes("/") ? "/" : ".";
            const firstNum = parseInt(dateParts[1], 10);
            const secondNum = parseInt(dateParts[2], 10);

            if (separator === "/" && firstNum <= 12) {
              // American format: M/D/Y
              month = firstNum;
              day = secondNum;
              year = parsedYear;
            } else {
              // European format: D.M.Y or D/M/Y
              day = firstNum;
              month = secondNum;
              year = parsedYear;
            }

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
      sheetsNotFound,
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
      sheetsNotFound: [],
    };
  }
}
