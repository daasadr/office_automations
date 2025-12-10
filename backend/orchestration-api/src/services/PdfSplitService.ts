/**
 * PDF Split Service
 * Handles splitting PDFs into individual pages
 */

import { PDFDocument } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import { downloadFile, uploadFile } from "@orchestration-api/lib/minio";
import { logger } from "@orchestration-api/utils/logger";

/**
 * Result of a page extraction
 */
export interface ExtractedPage {
  pageNumber: number;
  fileKey: string;
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
  originalFileKey: string;
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
    fileKey: string;
    bucket?: string;
  }): Promise<PdfSplitResult> {
    const { workflowId, fileKey, bucket } = params;
    const startTime = Date.now();

    logger.info("[PdfSplitService] Starting PDF split", {
      workflowId,
      fileKey,
      bucket,
    });

    try {
      // 1. Download the original PDF from MinIO
      logger.debug("[PdfSplitService] Downloading PDF from MinIO", { fileKey });
      const pdfBuffer = await downloadFile(fileKey, bucket);

      logger.info("[PdfSplitService] PDF downloaded", {
        size: pdfBuffer.length,
        fileKey,
      });

      // 2. Load the PDF document
      logger.debug("[PdfSplitService] Loading PDF document");
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();

      logger.info("[PdfSplitService] PDF loaded", {
        totalPages,
        fileKey,
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

          // Generate a unique file key for this page
          // Format: workflows/{workflowId}/pages/page-{pageNumber}-{uuid}.pdf
          const pageFileKey = `workflows/${workflowId}/pages/page-${pageNumber}-${uuidv4()}.pdf`;

          // Upload the page to MinIO
          logger.debug("[PdfSplitService] Uploading page to MinIO", {
            pageNumber,
            pageFileKey,
            size: pageBuffer.length,
          });

          const uploadResult = await uploadFile(pageFileKey, pageBuffer, {
            bucket,
            contentType: "application/pdf",
            metadata: {
              workflowId,
              originalFileKey: fileKey,
              pageNumber: pageNumber.toString(),
              totalPages: totalPages.toString(),
            },
          });

          extractedPages.push({
            pageNumber,
            fileKey: pageFileKey,
            mimeType: "application/pdf",
            size: uploadResult.size,
          });

          logger.debug("[PdfSplitService] Page uploaded successfully", {
            pageNumber,
            pageFileKey,
            size: uploadResult.size,
          });
        } catch (pageError) {
          const errorMessage = pageError instanceof Error ? pageError.message : String(pageError);

          logger.error("[PdfSplitService] Failed to extract page", {
            pageNumber,
            workflowId,
            fileKey,
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
        originalFileKey: fileKey,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("[PdfSplitService] PDF split failed", {
        workflowId,
        fileKey,
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
   * @param fileKey - MinIO key of the PDF file
   * @param bucket - MinIO bucket (optional)
   * @returns Number of pages in the PDF
   */
  async getPdfPageCount(fileKey: string, bucket?: string): Promise<number> {
    try {
      const pdfBuffer = await downloadFile(fileKey, bucket);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      return pdfDoc.getPageCount();
    } catch (error) {
      logger.error("[PdfSplitService] Failed to get page count", {
        fileKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const pdfSplitService = new PdfSplitService();
