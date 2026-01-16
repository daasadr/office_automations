/**
 * PDF Page Extractor Service
 * Extracts a single page from a PDF document
 */

import { PDFDocument } from "pdf-lib";
import { logger } from "@orchestration-api/utils/logger";

export interface ExtractPageOptions {
  pdfBuffer: Buffer;
  pageNumber: number; // 1-based page number (as displayed to users)
}

export interface ExtractPageResult {
  pdfBuffer: Buffer;
  pageNumber: number;
  originalPageCount: number;
}

export class PdfPageExtractor {
  /**
   * Extracts a single page from a PDF document
   * @param options.pdfBuffer - The source PDF as a Buffer
   * @param options.pageNumber - 1-based page number to extract
   * @returns The extracted page as a new PDF Buffer
   */
  async extractPage(options: ExtractPageOptions): Promise<ExtractPageResult> {
    const { pdfBuffer, pageNumber } = options;

    try {
      logger.info("[PdfPageExtractor] Extracting page", { pageNumber });

      // Load the source PDF
      const sourcePdf = await PDFDocument.load(pdfBuffer);
      const totalPages = sourcePdf.getPageCount();

      logger.debug("[PdfPageExtractor] Loaded PDF", {
        totalPages,
        requestedPage: pageNumber,
      });

      // Validate page number (1-based)
      if (pageNumber < 1 || pageNumber > totalPages) {
        throw new Error(`Invalid page number ${pageNumber}. Document has ${totalPages} pages.`);
      }

      // Create a new PDF document
      const newPdf = await PDFDocument.create();

      // Copy the requested page (convert 1-based to 0-based index)
      const pageIndex = pageNumber - 1;
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
      newPdf.addPage(copiedPage);

      // Save the new PDF
      const newPdfBytes = await newPdf.save();
      const resultBuffer = Buffer.from(newPdfBytes);

      logger.info("[PdfPageExtractor] Page extracted successfully", {
        pageNumber,
        originalPageCount: totalPages,
        extractedSize: resultBuffer.length,
      });

      return {
        pdfBuffer: resultBuffer,
        pageNumber,
        originalPageCount: totalPages,
      };
    } catch (error) {
      logger.error("[PdfPageExtractor] Error extracting page", {
        pageNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const pdfPageExtractor = new PdfPageExtractor();
