import { logger } from "../utils/logger";
import { augmentExcelWithData } from "../lib/excel";
import type { SheetNotFound, DuplicateRecord, LLMExtractedData } from "../lib/excel/types";
import { jobService } from "./JobService";
import { directusDocumentService } from "../lib/directus";
import type { FoundationDocument } from "../lib/directus/types";
import type { LLMResponseSchema } from "../llmResponseSchema";
import {
  filterRecentResponses,
  RESPONSE_MAX_AGE_HOURS,
  parseResponseJson,
  isValidationResult,
  toLLMResponseSchema,
  formatExtractedRecordsDetail,
  generateTimestampForFilename,
  generateFoundationFilename,
  generateFoundationTitle,
} from "../utils/dataTransformers";

/**
 * Result of foundation document processing
 */
export interface FoundationProcessingResult {
  success: boolean;
  foundationDocument?: {
    id: string;
    title: string;
    status: string;
    basedOn: {
      id: string;
      title: string;
    };
  };
  processing?: {
    sheetsModified: string[];
    extractedDataCount: number;
    recordsAdded: number;
    duplicatesSkipped: DuplicateRecord[];
    sheetsNotFound: SheetNotFound[];
    confidence: number;
    sourceDocumentId?: string;
    responseId?: string;
    extractedRecordsDetail: Record<string, unknown>[];
  };
  error?: string;
}

/**
 * Service class for processing foundation documents.
 *
 * This service handles the complex workflow of:
 * - Retrieving LLM responses from multiple sources (jobId, responseId, sourceDocumentId)
 * - Fetching and downloading approved foundation documents
 * - Augmenting Excel files with extracted data
 * - Creating new draft foundation documents
 * - Managing duplicate detection and sheet modifications
 *
 * @example
 * ```typescript
 * const service = new FoundationProcessingService();
 * const result = await service.processFoundationDocument({
 *   sourceDocumentId: 'doc-123'
 * });
 *
 * if (result.success) {
 *   console.log('Created document:', result.foundationDocument.id);
 * }
 * ```
 */
export class FoundationProcessingService {
  /**
   * Retrieves LLM response data from a source document.
   * Filters responses to only include recent ones (within 8 hours).
   *
   * @param sourceDocumentId - The source document ID
   * @returns LLM response data and metadata
   * @throws Error if no recent responses found
   */
  async getLLMResponseBySourceDocument(sourceDocumentId: string): Promise<{
    llmResponseData: LLMResponseSchema;
    responseId: string;
  }> {
    logger.info("Fetching latest response for source document", { sourceDocumentId });

    const allResponses =
      await directusDocumentService.getResponsesBySourceDocument(sourceDocumentId);
    const responses = filterRecentResponses(allResponses || []);

    if (!responses || responses.length === 0) {
      throw new Error(
        `No recent responses found for document ${sourceDocumentId}. Responses must be within the last ${RESPONSE_MAX_AGE_HOURS} hours.`
      );
    }

    // Sort by created_at to get the latest response
    const latestResponse = responses.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];

    if (!latestResponse.response_json) {
      throw new Error(`Latest response ${latestResponse.id} has no response data`);
    }

    logger.info("Using latest response", {
      responseId: latestResponse.id,
      sourceDocumentId,
      responseDate: latestResponse.created_at,
    });

    const validationResult = parseResponseJson(latestResponse.response_json);
    if (!validationResult) {
      throw new Error("Invalid response data structure");
    }

    return {
      llmResponseData: toLLMResponseSchema(validationResult),
      responseId: latestResponse.id!,
    };
  }

  /**
   * Retrieves LLM response data from a job ID.
   *
   * @param jobId - The job ID
   * @returns LLM response data and source document ID
   * @throws Error if job not found or has no validation result
   */
  async getLLMResponseByJobId(jobId: string): Promise<{
    llmResponseData: LLMResponseSchema;
    sourceDocumentId?: string;
  }> {
    const job = jobService.getJob(jobId);
    if (!job || !job.validationResult) {
      throw new Error("Job not found or has no validation result");
    }

    if (!isValidationResult(job.validationResult)) {
      throw new Error("Job validation result has invalid structure");
    }

    return {
      llmResponseData: toLLMResponseSchema(job.validationResult),
      sourceDocumentId: job.directusSourceDocumentId,
    };
  }

  /**
   * Retrieves LLM response data from a response ID.
   *
   * @param responseId - The response ID
   * @returns LLM response data and source document ID
   * @throws Error if response not found or has no response data
   */
  async getLLMResponseByResponseId(responseId: string): Promise<{
    llmResponseData: LLMResponseSchema;
    sourceDocumentId?: string;
  }> {
    const response = await directusDocumentService.getResponse(responseId);
    if (!response || !response.response_json) {
      throw new Error("Response not found or has no response data");
    }

    const validationResult = parseResponseJson(response.response_json);
    if (!validationResult) {
      throw new Error("Invalid response data structure");
    }

    return {
      llmResponseData: toLLMResponseSchema(validationResult),
      sourceDocumentId: response.source_document,
    };
  }

  /**
   * Downloads the last approved foundation document.
   *
   * @returns The document metadata and Excel buffer
   * @throws Error if no approved document found or download fails
   */
  async getLastApprovedFoundationDocument(): Promise<{
    document: FoundationDocument;
    buffer: Buffer;
  }> {
    const lastApprovedDoc = await directusDocumentService.getLastApprovedFoundationDocument();

    if (!lastApprovedDoc) {
      throw new Error(
        "No approved foundation document found. Please ensure there is at least one foundation document with 'approved' status in Directus."
      );
    }

    if (!lastApprovedDoc.file) {
      throw new Error(`Approved foundation document ${lastApprovedDoc.id} has no file attached`);
    }

    logger.info("Retrieved last approved foundation document", {
      documentId: lastApprovedDoc.id,
      title: lastApprovedDoc.title,
      fileId: lastApprovedDoc.file,
    });

    // Download the Excel file
    const excelBuffer = await directusDocumentService.downloadFile(lastApprovedDoc.file);

    if (!excelBuffer) {
      throw new Error(`Failed to download foundation document file ${lastApprovedDoc.id}`);
    }

    logger.info("Downloaded foundation document file", {
      size: excelBuffer.length,
    });

    return {
      document: lastApprovedDoc,
      buffer: excelBuffer,
    };
  }

  /**
   * Augments an Excel file with extracted data.
   *
   * @param excelBuffer - The Excel file buffer
   * @param extractedData - Data to add to the Excel
   * @returns Augmentation result with modified buffer
   * @throws Error if augmentation fails
   */
  async augmentExcel(
    excelBuffer: Buffer,
    extractedData: LLMExtractedData[]
  ): Promise<{
    buffer: Buffer;
    sheetsModified: string[];
    recordsAdded: number;
    duplicatesSkipped: DuplicateRecord[];
    sheetsNotFound: SheetNotFound[];
  }> {
    const augmentResult = await augmentExcelWithData(excelBuffer, extractedData);

    if (!augmentResult.success || !augmentResult.buffer) {
      throw new Error(`Failed to augment Excel file: ${augmentResult.error || "Unknown error"}`);
    }

    logger.info("Excel file augmented successfully", {
      sheetsModified: augmentResult.sheetsModified,
      bufferSize: augmentResult.buffer.length,
      recordsAdded: augmentResult.recordsAdded,
      duplicatesSkipped: augmentResult.duplicatesSkipped.length,
    });

    return {
      buffer: augmentResult.buffer,
      sheetsModified: augmentResult.sheetsModified,
      recordsAdded: augmentResult.recordsAdded,
      duplicatesSkipped: augmentResult.duplicatesSkipped,
      sheetsNotFound: augmentResult.sheetsNotFound || [],
    };
  }

  /**
   * Main method to process a foundation document.
   * Orchestrates the entire workflow from data retrieval to document creation.
   *
   * @param params - Processing parameters (one of jobId, responseId, or sourceDocumentId required)
   * @returns Processing result with created document details
   */
  async processFoundationDocument(params: {
    jobId?: string;
    responseId?: string;
    sourceDocumentId?: string;
  }): Promise<FoundationProcessingResult> {
    const { jobId, responseId, sourceDocumentId } = params;

    try {
      logger.info("Starting foundation document processing");

      // Get LLM response data from the appropriate source
      let llmResponseData: LLMResponseSchema;
      let actualSourceDocumentId: string | undefined;
      let usedResponseId: string | undefined;

      if (sourceDocumentId) {
        const result = await this.getLLMResponseBySourceDocument(sourceDocumentId);
        llmResponseData = result.llmResponseData;
        actualSourceDocumentId = sourceDocumentId;
        usedResponseId = result.responseId;
      } else if (jobId) {
        const result = await this.getLLMResponseByJobId(jobId);
        llmResponseData = result.llmResponseData;
        actualSourceDocumentId = result.sourceDocumentId;
      } else if (responseId) {
        const result = await this.getLLMResponseByResponseId(responseId);
        llmResponseData = result.llmResponseData;
        actualSourceDocumentId = result.sourceDocumentId;
        usedResponseId = responseId;
      } else {
        throw new Error("Either jobId, responseId, or sourceDocumentId is required");
      }

      if (!llmResponseData || !llmResponseData.extracted_data) {
        throw new Error("No extracted data found in LLM response");
      }

      logger.info("Retrieved LLM response data", {
        extractedDataCount: llmResponseData.extracted_data.length,
        confidence: llmResponseData.confidence,
      });

      // Get last approved foundation document
      const { document: lastApprovedDoc, buffer: excelBuffer } =
        await this.getLastApprovedFoundationDocument();

      // Augment the Excel file with extracted data
      const augmentResult = await this.augmentExcel(excelBuffer, llmResponseData.extracted_data);

      // Generate filename and notes
      const timestamp = generateTimestampForFilename();
      const newFilename = generateFoundationFilename(lastApprovedDoc.title, timestamp);

      let notes = `Augmented from foundation document "${lastApprovedDoc.title}" with ${llmResponseData.extracted_data.length} extracted data items. Sheets modified: ${augmentResult.sheetsModified.join(", ")}.`;
      if (augmentResult.duplicatesSkipped.length > 0) {
        notes += ` Skipped ${augmentResult.duplicatesSkipped.length} duplicate records.`;
      }

      // Save as new draft foundation document
      const newFoundationDoc = await directusDocumentService.createFoundationDocument({
        title: generateFoundationTitle(lastApprovedDoc.title, timestamp),
        file: {
          filename: newFilename,
          buffer: augmentResult.buffer,
          mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          title: newFilename,
        },
        sourceDocumentId: actualSourceDocumentId,
        docType: lastApprovedDoc.doc_type || "waste_management",
        status: "draft",
        contentJson: {
          basedOnDocument: lastApprovedDoc.id,
          augmentedWith: {
            jobId: jobId || undefined,
            responseId: usedResponseId || responseId || undefined,
            sourceDocumentId: actualSourceDocumentId,
            extractedDataCount: llmResponseData.extracted_data.length,
            recordsAdded: augmentResult.recordsAdded,
            duplicatesSkipped: augmentResult.duplicatesSkipped.length,
            sheetsModified: augmentResult.sheetsModified,
            confidence: llmResponseData.confidence,
          },
          augmentedAt: new Date().toISOString(),
        },
        notes,
      });

      logger.info("New draft foundation document created", {
        documentId: newFoundationDoc.id,
        title: newFoundationDoc.title,
      });

      // Format detailed records for response
      const extractedRecordsDetail = formatExtractedRecordsDetail(llmResponseData.extracted_data);

      return {
        success: true,
        foundationDocument: {
          id: newFoundationDoc.id || "",
          title: newFoundationDoc.title,
          status: newFoundationDoc.status || "draft",
          basedOn: {
            id: lastApprovedDoc.id || "",
            title: lastApprovedDoc.title,
          },
        },
        processing: {
          sheetsModified: augmentResult.sheetsModified,
          extractedDataCount: llmResponseData.extracted_data.length,
          recordsAdded: augmentResult.recordsAdded,
          duplicatesSkipped: augmentResult.duplicatesSkipped,
          sheetsNotFound: augmentResult.sheetsNotFound,
          confidence: llmResponseData.confidence,
          sourceDocumentId: actualSourceDocumentId,
          responseId: usedResponseId || responseId,
          extractedRecordsDetail,
        },
      };
    } catch (error) {
      logger.error("Error processing foundation document:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
