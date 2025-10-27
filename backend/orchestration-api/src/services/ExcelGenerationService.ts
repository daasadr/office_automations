import { logger } from "../utils/logger";
import { generateExcelFile } from "../lib/excel";
import type { ValidationResult as LLMValidationResult } from "./llm";
import { jobService } from "./JobService";
import { directusDocumentService } from "../lib/directus";
import {
  filterRecentResponses,
  parseResponseJson,
  isValidationResult,
  getExtractedData,
  ensureProvider,
} from "../utils/dataTransformers";
import type { ValidationResult } from "../routes/documents/types";

/**
 * Result of Excel generation
 */
export interface ExcelGenerationResult {
  success: boolean;
  buffer?: Buffer;
  filename?: string;
  error?: string;
  generatedDocumentId?: string;
}

/**
 * Service class for generating Excel files from validation data.
 *
 * This service handles:
 * - Retrieving validation data from multiple sources (Directus or in-memory jobs)
 * - Generating Excel files from validation results
 * - Saving generated documents to Directus
 * - Managing fallback logic between data sources
 *
 * @example
 * ```typescript
 * const service = new ExcelGenerationService();
 * const result = await service.generateExcel({
 *   documentId: 'doc-123'
 * });
 *
 * if (result.success && result.buffer) {
 *   // Send buffer to client
 *   res.send(result.buffer);
 * }
 * ```
 */
export class ExcelGenerationService {
  /**
   * Retrieves validation data from Directus by document ID.
   * Only returns recent responses (within 8 hours).
   *
   * @param documentId - The source document ID
   * @returns Validation result and response ID, or null if not found
   */
  async getValidationDataFromDirectus(
    documentId: string
  ): Promise<{ validationResult: ValidationResult; responseId: string } | null> {
    try {
      logger.info("Fetching validation data from Directus by document ID", { documentId });

      const allResponses = await directusDocumentService.getResponsesBySourceDocument(documentId);
      const responses = filterRecentResponses(allResponses || []);

      if (responses && responses.length > 0) {
        // Get latest response
        const latestResponse = responses.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        })[0];

        const validationResult = parseResponseJson(latestResponse.response_json);
        if (validationResult) {
          logger.info("Retrieved validation data from Directus", {
            documentId,
            responseId: latestResponse.id,
          });
          return {
            validationResult,
            responseId: latestResponse.id!,
          };
        }
      }

      return null;
    } catch (directusError) {
      logger.warn("Failed to fetch data from Directus", {
        documentId,
        error: directusError,
      });
      return null;
    }
  }

  /**
   * Retrieves validation data from in-memory job by job ID.
   *
   * @param jobId - The job ID
   * @returns Validation result or null if not found
   */
  getValidationDataFromJob(jobId: string): ValidationResult | null {
    const job = jobService.getJob(jobId);
    if (job?.validationResult && isValidationResult(job.validationResult)) {
      logger.info("Retrieved validation data from job", { jobId });
      return job.validationResult;
    }
    return null;
  }

  /**
   * Generates an Excel file from validation results.
   *
   * @param params - Generation parameters
   * @returns Excel buffer and filename
   * @throws Error if generation fails
   */
  async generateExcelFromValidation(params: {
    identifier: string;
    validationResult: ValidationResult;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const { identifier, validationResult } = params;

    const excelResult = await generateExcelFile({
      jobId: identifier,
      validationResult: ensureProvider(validationResult) as unknown as LLMValidationResult,
    });

    if (!excelResult.success || !excelResult.buffer || !excelResult.filename) {
      throw new Error(`Failed to generate Excel file: ${excelResult.error || "Unknown error"}`);
    }

    return {
      buffer: excelResult.buffer,
      filename: excelResult.filename,
    };
  }

  /**
   * Saves generated Excel document to Directus.
   *
   * @param params - Save parameters
   * @returns Generated document ID
   */
  async saveGeneratedDocument(params: {
    responseId: string;
    buffer: Buffer;
    filename: string;
    validationResult: ValidationResult;
    documentId?: string;
    jobId?: string;
  }): Promise<string> {
    const { responseId, buffer, filename, validationResult, documentId, jobId } = params;

    try {
      logger.info("Saving generated document to Directus", {
        documentId,
        jobId,
        responseId,
      });

      const generatedDocument = await directusDocumentService.createGeneratedDocument({
        responseId,
        file: {
          filename,
          buffer,
          mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          title: `Generated Excel - ${filename}`,
        },
        documentType: "excel",
        generationStatus: "completed",
        generationParams: {
          documentId: documentId || undefined,
          jobId: jobId || undefined,
          extractedDataCount: getExtractedData(validationResult).length,
          confidence: validationResult.confidence,
        },
      });

      logger.info("Generated document saved to Directus", {
        documentId,
        jobId,
        generatedDocumentId: generatedDocument.id,
      });

      return generatedDocument.id!;
    } catch (directusError) {
      logger.warn("Failed to save generated document to Directus", {
        documentId,
        jobId,
        error: directusError,
      });
      throw directusError;
    }
  }

  /**
   * Main method to generate Excel file with automatic data source resolution.
   * Tries Directus first (persistent), then falls back to in-memory job data.
   *
   * @param params - Generation parameters
   * @returns Generation result with buffer and metadata
   */
  async generateExcel(params: {
    documentId?: string;
    jobId?: string;
    saveToDirectus?: boolean;
  }): Promise<ExcelGenerationResult> {
    const { documentId, jobId, saveToDirectus = true } = params;

    try {
      if (!documentId && !jobId) {
        return {
          success: false,
          error: "Document ID or Job ID is required",
        };
      }

      let validationResult: ValidationResult | null = null;
      let identifier = documentId || jobId!;
      let responseId: string | undefined;

      // Try to get data from document UUID first (persists after restart)
      if (documentId) {
        const directusData = await this.getValidationDataFromDirectus(documentId);
        if (directusData) {
          validationResult = directusData.validationResult;
          responseId = directusData.responseId;
        }
      }

      // Fall back to job ID if document UUID didn't work
      if (!validationResult && jobId) {
        validationResult = this.getValidationDataFromJob(jobId);
        identifier = jobId;
      }

      if (!validationResult) {
        return {
          success: false,
          error: documentId
            ? "No response found for this document ID"
            : "No job found for this job ID",
        };
      }

      // Generate Excel file
      const { buffer, filename } = await this.generateExcelFromValidation({
        identifier,
        validationResult,
      });

      // Save to Directus if requested and we have a response ID
      let generatedDocumentId: string | undefined;
      if (saveToDirectus && responseId) {
        try {
          generatedDocumentId = await this.saveGeneratedDocument({
            responseId,
            buffer,
            filename,
            validationResult,
            documentId,
            jobId,
          });
        } catch (error) {
          // Non-fatal - we still have the Excel file
          logger.warn("Could not save generated document to Directus, continuing", { error });
        }
      } else if (saveToDirectus && jobId && !responseId) {
        // Try to save using job's associated response
        const job = jobService.getJob(jobId);
        if (job?.directusResponseId) {
          try {
            generatedDocumentId = await this.saveGeneratedDocument({
              responseId: job.directusResponseId,
              buffer,
              filename,
              validationResult,
              jobId,
            });
          } catch (error) {
            logger.warn("Could not save generated document to Directus, continuing", { error });
          }
        }
      }

      return {
        success: true,
        buffer,
        filename,
        generatedDocumentId,
      };
    } catch (error) {
      logger.error("Error generating Excel file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
