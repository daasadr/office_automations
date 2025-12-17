/**
 * PDF Split Service
 * Handles splitting PDFs into individual pages
 * Uses Directus for file management (which internally uses MinIO)
 */

import { PDFDocument } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import { directusDocumentService } from "@orchestration-api/lib/directus";
import { logger } from "@orchestration-api/utils/logger";

/**
 * Result of a page extraction
 */
export interface ExtractedPage {
  pageNumber: number;
  fileId: string; // Directus file ID
  mimeType: string;
  size: number;
}

/**
 * Result of PDF splitting operation
 */
export interface PdfSplitResult {
  pages: ExtractedPage[];
  totalPages: number;
  processingTimeMs: number;
  originalFileId: string; // Directus file ID
}

/**
 * PDF Split Service
 */
export class PdfSplitService {
  /**
   * Splits a PDF into individual page PDFs
   *
   * @param params - Parameters for PDF splitting
   * @returns Split result with page information
   */
  async splitPdfIntoPages(params: {
    workflowId: string;
    fileId: string; // Directus file ID
  }): Promise<PdfSplitResult> {
    const { workflowId, fileId } = params;
    const startTime = Date.now();

    logger.info("[PdfSplitService] Starting PDF split", {
      workflowId,
      fileId,
    });

    try {
      // 1. Download the original PDF from Directus
      logger.debug("[PdfSplitService] Downloading PDF from Directus", { fileId });
      const pdfBuffer = await directusDocumentService.downloadFile(fileId);

      if (!pdfBuffer) {
        throw new Error(`Failed to download file ${fileId} from Directus`);
      }

      logger.info("[PdfSplitService] PDF downloaded", {
        size: pdfBuffer.length,
        fileId,
      });

      // 2. Load the PDF document
      logger.debug("[PdfSplitService] Loading PDF document");
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();

      logger.info("[PdfSplitService] PDF loaded", {
        totalPages,
        fileId,
      });

      // 3. Extract and save each page
      const extractedPages: ExtractedPage[] = [];

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const pageNumber = pageIndex + 1; // 1-based page numbering

        logger.debug("[PdfSplitService] Extracting page", {
          pageNumber,
          totalPages,
          workflowId,
        });

        try {
          // Create a new PDF document for this single page
          const singlePageDoc = await PDFDocument.create();

          // Copy the page from the original document
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
          singlePageDoc.addPage(copiedPage);

          // Save the single-page PDF as bytes
          const pageBytes = await singlePageDoc.save();
          const pageBuffer = Buffer.from(pageBytes);

          // Generate a unique filename for this page
          const pageFilename = `workflow-${workflowId}-page-${pageNumber}-${uuidv4()}.pdf`;

          // Upload the page to Directus (which stores it in MinIO)
          logger.debug("[PdfSplitService] Uploading page to Directus", {
            pageNumber,
            pageFilename,
            size: pageBuffer.length,
          });

          const uploadedFile = await directusDocumentService.uploadFile({
            filename: pageFilename,
            buffer: pageBuffer,
            mimetype: "application/pdf",
            title: `Page ${pageNumber} - Workflow ${workflowId}`,
          });

          if (!uploadedFile || !uploadedFile.id) {
            throw new Error(`Failed to upload page ${pageNumber} to Directus`);
          }

          extractedPages.push({
            pageNumber,
            fileId: uploadedFile.id,
            mimeType: "application/pdf",
            size: pageBuffer.length,
          });

          logger.debug("[PdfSplitService] Page uploaded successfully", {
            pageNumber,
            fileId: uploadedFile.id,
            size: pageBuffer.length,
          });
        } catch (pageError) {
          const errorMessage = pageError instanceof Error ? pageError.message : String(pageError);

          logger.error("[PdfSplitService] Failed to extract page", {
            pageNumber,
            workflowId,
            fileId,
            error: errorMessage,
          });

          // Continue with other pages even if one fails
          // The workflow will handle partial failures
          continue;
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info("[PdfSplitService] PDF split completed", {
        workflowId,
        totalPages,
        extractedPages: extractedPages.length,
        failedPages: totalPages - extractedPages.length,
        processingTimeMs: processingTime,
      });

      return {
        pages: extractedPages,
        totalPages,
        processingTimeMs: processingTime,
        originalFileId: fileId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("[PdfSplitService] PDF split failed", {
        workflowId,
        fileId,
        error: errorMessage,
        stack: errorStack,
      });

      throw new Error(`Failed to split PDF: ${errorMessage}`);
    }
  }

  /**
   * Validates that a file is a valid PDF
   *
   * @param buffer - The file buffer to validate
   * @returns True if valid PDF, false otherwise
   */
  async validatePdf(buffer: Buffer): Promise<boolean> {
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      return pdfDoc.getPageCount() > 0;
    } catch (error) {
      logger.warn("[PdfSplitService] PDF validation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Gets the number of pages in a PDF without fully processing it
   *
   * @param fileId - Directus file ID
   * @returns Number of pages in the PDF
   */
  async getPdfPageCount(fileId: string): Promise<number> {
    try {
      const pdfBuffer = await directusDocumentService.downloadFile(fileId);
      if (!pdfBuffer) {
        throw new Error(`Failed to download file ${fileId}`);
      }
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      return pdfDoc.getPageCount();
    } catch (error) {
      logger.error("[PdfSplitService] Failed to get page count", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const pdfSplitService = new PdfSplitService();
