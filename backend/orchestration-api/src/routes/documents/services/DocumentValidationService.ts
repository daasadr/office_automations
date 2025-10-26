import { logger } from "../../../utils/logger";
import { validateDocumentContent } from "../../../services/llm";
import type { ValidationResult } from "../../../services/llm";
import { directusDocumentService } from "../../../lib/directus";

/**
 * Service class for handling document validation operations.
 *
 * This service encapsulates the complex workflow of:
 * - Saving source documents to Directus
 * - Processing documents with LLM (Gemini)
 * - Storing validation results and responses
 * - Managing document processing lifecycle
 *
 * @example
 * ```typescript
 * const service = new DocumentValidationService();
 * const result = await service.processDocument({
 *   jobId: 'job-123',
 *   filename: 'document.pdf',
 *   buffer: pdfBuffer,
 *   mimetype: 'application/pdf',
 *   size: 1024000
 * });
 * ```
 */
export class DocumentValidationService {
  /**
   * Saves a source document to Directus.
   *
   * @param params - Document parameters
   * @param params.filename - Original filename
   * @param params.buffer - File buffer
   * @param params.mimetype - MIME type of the file
   * @param params.jobId - Associated job ID for logging
   * @returns The created source document ID
   * @throws Error if Directus save fails
   */
  async saveSourceDocument(params: {
    filename: string;
    buffer: Buffer;
    mimetype: string;
    jobId: string;
  }): Promise<string> {
    const { filename, buffer, mimetype, jobId } = params;

    try {
      logger.info("Saving source document to Directus", { jobId });
      const sourceDocument = await directusDocumentService.createSourceDocument({
        title: filename,
        file: {
          filename,
          buffer,
          mimetype,
        },
        processingStatus: "processing",
      });

      logger.info("Source document saved to Directus", {
        jobId,
        sourceDocumentId: sourceDocument.id,
      });

      return sourceDocument.id!;
    } catch (error) {
      logger.error("Failed to save source document to Directus", {
        jobId,
        error,
      });
      throw new Error(
        `Failed to save document: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Validates document content using LLM (Gemini).
   *
   * @param buffer - Document buffer (PDF)
   * @returns Validation result from LLM
   */
  async validateWithLLM(buffer: Buffer): Promise<ValidationResult> {
    const arrayBuffer = new Uint8Array(buffer).buffer;
    const validationResult = await validateDocumentContent(arrayBuffer, {
      provider: "gemini",
    });
    return validationResult;
  }

  /**
   * Saves LLM response to Directus.
   *
   * @param params - Response parameters
   * @returns The created response ID
   */
  async saveLLMResponse(params: {
    sourceDocumentId: string;
    validationResult: ValidationResult;
    processingTimeMs: number;
    jobId: string;
  }): Promise<string> {
    const { sourceDocumentId, validationResult, processingTimeMs, jobId } = params;

    try {
      logger.info("Saving LLM response to Directus", { jobId, sourceDocumentId });

      const response = await directusDocumentService.createResponse({
        sourceDocumentId,
        prompt: "PDF document validation and data extraction",
        responseJson: {
          present: validationResult.present,
          missing: validationResult.missing,
          confidence: validationResult.confidence,
          extracted_data: validationResult.extracted_data,
        },
        modelName: "gemini-2.5-flash",
        tokenCount: undefined,
        processingTimeMs,
        status: "completed",
      });

      logger.info("LLM response saved to Directus", {
        jobId,
        sourceDocumentId,
        responseId: response.id,
      });

      return response.id!;
    } catch (error) {
      logger.error("Failed to save LLM response to Directus", {
        jobId,
        sourceDocumentId,
        error,
      });
      throw error;
    }
  }

  /**
   * Updates the processing status of a source document.
   *
   * @param sourceDocumentId - Document ID
   * @param status - New status ('completed' | 'failed' | 'processing')
   */
  async updateDocumentStatus(
    sourceDocumentId: string,
    status: "completed" | "failed" | "processing"
  ): Promise<void> {
    try {
      await directusDocumentService.updateSourceDocumentStatus(sourceDocumentId, status);
    } catch (error) {
      logger.warn("Failed to update source document status in Directus", {
        sourceDocumentId,
        status,
        error,
      });
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Processes a document through the complete validation workflow.
   * This method orchestrates the entire process including saving, validating,
   * and storing results.
   *
   * @param params - Document parameters
   * @returns Processing result with document and response IDs
   */
  async processDocument(params: {
    jobId: string;
    filename: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): Promise<{
    sourceDocumentId: string;
    responseId?: string;
    validationResult?: ValidationResult;
    processingTimeMs?: number;
    error?: string;
  }> {
    const { jobId, filename, buffer, mimetype } = params;

    // Save source document
    const sourceDocumentId = await this.saveSourceDocument({
      filename,
      buffer,
      mimetype,
      jobId,
    });

    try {
      // Validate with LLM
      logger.info("Starting async PDF processing with Gemini", { jobId, sourceDocumentId });
      const startTime = Date.now();
      const validationResult = await this.validateWithLLM(buffer);
      const processingTimeMs = Date.now() - startTime;

      // Save LLM response
      const responseId = await this.saveLLMResponse({
        sourceDocumentId,
        validationResult,
        processingTimeMs,
        jobId,
      });

      // Update document status
      await this.updateDocumentStatus(sourceDocumentId, "completed");

      logger.info("PDF validation completed successfully with Gemini", {
        jobId,
        sourceDocumentId,
        processingTimeMs,
      });

      return {
        sourceDocumentId,
        responseId,
        validationResult,
        processingTimeMs,
      };
    } catch (error) {
      logger.error("Gemini PDF validation failed", {
        jobId,
        sourceDocumentId,
        error,
      });

      // Update document status to failed
      await this.updateDocumentStatus(sourceDocumentId, "failed");

      return {
        sourceDocumentId,
        error: error instanceof Error ? error.message : "PDF validation failed",
      };
    }
  }
}
