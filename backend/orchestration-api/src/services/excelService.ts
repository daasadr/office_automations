import * as XLSX from 'xlsx';
import { logger } from '../utils/logger';
import { ExtractedData, ValidationResult } from './llmService';

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

export async function generateExcelFile(input: GenerateExcelInput): Promise<GenerateExcelResult> {
  try {
    logger.info('Starting Excel generation', { jobId: input.jobId });

    const { validationResult } = input;
    
    if (!validationResult || !validationResult.extracted_data) {
      throw new Error('No validation result or extracted data provided');
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Process each waste code entry
    validationResult.extracted_data.forEach((item, index) => {
      // Get waste code from either new or legacy format
      const kodOdpadu = item['kód odpadu'] || item.kod_odpadu || `Záznam_${index + 1}`;
      
      // Create safe sheet name (Excel has limitations on sheet names)
      let sheetName = kodOdpadu.replace(/[[\]\\/:*?]/g, '_').substring(0, 31);
      if (sheetName === '') sheetName = 'List1';
      
      // Ensure unique sheet names
      let finalSheetName = sheetName;
      let counter = 1;
      while (workbook.SheetNames.includes(finalSheetName)) {
        finalSheetName = `${sheetName}_${counter}`;
        counter++;
      }

      // Helper function to add object properties as rows
      const addObjectToWorksheet = (obj: any, worksheetData: any[], title: string, indent = '', visited = new Set()) => {
        if (!obj || visited.has(obj)) return;
        visited.add(obj);
        
        worksheetData.push({
          'A': title,
          'B': '',
          'C': '',
          'D': '',
          'E': '',
          'F': ''
        });

        Object.entries(obj).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            if (Array.isArray(value)) {
              // Skip arrays here, handle them separately
              return;
            } else if (typeof value === 'object' && indent.length < 20) { // Limit depth to prevent infinite recursion
              // Handle nested objects
              addObjectToWorksheet(value, worksheetData, `${indent}${key.replace(/_/g, ' ')}:`, indent + '  ', visited);
            } else {
              // Handle simple values
              worksheetData.push({
                'A': `${indent}${key.replace(/_/g, ' ')}:`,
                'B': String(value),
                'C': '',
                'D': '',
                'E': '',
                'F': ''
              });
            }
          }
        });
        worksheetData.push({}); // Empty row
      };

      // Helper function to add arrays as tables
      const addArrayAsTable = (arr: any[], worksheetData: any[], title: string) => {
        if (!arr || arr.length === 0) return;

        worksheetData.push({
          'A': title,
          'B': '',
          'C': '',
          'D': '',
          'E': '',
          'F': ''
        });

        // Get all unique keys from all objects in the array
        const allKeys = new Set<string>();
        arr.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(key => allKeys.add(key));
          }
        });

        const keys = Array.from(allKeys);
        
        // Add header row with clean column names
        const headerRow: any = {};
        keys.forEach((key, index) => {
          const columnLetter = String.fromCharCode(65 + index); // A, B, C, D...
          headerRow[columnLetter] = key.replace(/_/g, ' ');
        });
        worksheetData.push(headerRow);

        // Add data rows
        arr.forEach(rowData => {
          const dataRow: any = {};
          keys.forEach((key, index) => {
            const columnLetter = String.fromCharCode(65 + index);
            dataRow[columnLetter] = rowData[key] !== null && rowData[key] !== undefined ? String(rowData[key]) : '';
          });
          worksheetData.push(dataRow);
        });

        worksheetData.push({}); // Empty row
      };

      // Create worksheet data
      const worksheetData: any[] = [];

      // Add basic information (non-array, non-object fields)
      const basicInfo: any = {};
      Object.entries(item).forEach(([key, value]) => {
        if (!Array.isArray(value) && typeof value !== 'object') {
          basicInfo[key] = value;
        }
      });

      if (Object.keys(basicInfo).length > 0) {
        addObjectToWorksheet(basicInfo, worksheetData, 'INFORMACE O ODPADU', '', new Set());
      }

      // Add nested objects (like původce, odběratel)
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          addObjectToWorksheet(value, worksheetData, key.replace(/_/g, ' ').toUpperCase(), '', new Set());
        }
      });

      // Add arrays as tables
      Object.entries(item).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          addArrayAsTable(value, worksheetData, key.replace(/_/g, ' ').toUpperCase());
        }
      });

      // Create worksheet from data without technical headers
      const worksheet = XLSX.utils.json_to_sheet(worksheetData, { 
        skipHeader: true,
        header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
      });
      
      // Set column widths for better readability
      const maxColumns = worksheetData.length > 0 ? Math.max(...worksheetData.map(row => Object.keys(row).length), 6) : 6;
      const columnWidths = Array.from({length: maxColumns}, (_, i) => {
        if (i === 0) return { wch: 30 }; // First column - labels
        if (i === 1) return { wch: 30 }; // Second column - values
        return { wch: 20 }; // Other columns
      });
      worksheet['!cols'] = columnWidths;

      // Add sheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
    });

    // If no data was processed, create a summary sheet
    if (validationResult.extracted_data.length === 0) {
      const summaryData = [{
        'Info': 'Žádná data nebyla nalezena v dokumentu',
        'Celkem záznamů': validationResult.extracted_data.length,
        'Důvěryhodnost': `${validationResult.confidence.toFixed(1)}%`,
        'Nalezené informace': validationResult.present.join(', '),
        'Chybějící informace': validationResult.missing.join(', '),
      }];
      
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Přehled');
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true 
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `odpady_${input.jobId}_${timestamp}.xlsx`;

    logger.info('Excel generation completed successfully', { 
      jobId: input.jobId, 
      filename,
      bufferSize: excelBuffer.length,
      sheetCount: workbook.SheetNames.length
    });

    return {
      jobId: input.jobId,
      filename,
      buffer: Buffer.from(excelBuffer),
      success: true
    };

  } catch (error) {
    logger.error('Excel generation failed', { jobId: input.jobId, error });
    
    return {
      jobId: input.jobId,
      filename: '',
      buffer: Buffer.alloc(0),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Excel generation error'
    };
  }
}
