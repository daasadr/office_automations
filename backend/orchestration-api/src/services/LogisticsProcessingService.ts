/**
 * Logistics Processing Service
 * Handles processing of logistics documents (invoices with transport documents)
 * Features:
 * - Hash-based duplicate detection
 * - Token estimation for context window checking
 * - Intelligent PDF chunking for large documents
 * - Result aggregation from chunked processing
 */

import { createHash } from "crypto";
import { PDFDocument } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@orchestration-api/utils/logger";
import { directusDocumentService } from "@orchestration-api/lib/directus";
import { validatePdfContentWithGemini } from "@orchestration-api/services/llm";
import { requireDirectus } from "@orchestration-api/lib/directus/client";
import { createItem, readItems, updateItem } from "@directus/sdk";
import type { LogisticsDocument } from "@orchestration-api/lib/directus/types";

/**
 * Token estimation constants
 * Based on empirical observations of PDF content density
 */
const TOKENS_PER_PAGE_ESTIMATE = 3000; // Average tokens per PDF page
const GEMINI_CONTEXT_WINDOW = 1000000; // 1M tokens for gemini-2.5-flash
const SAFETY_MARGIN = 0.8; // Use 80% of context window to be safe
const MAX_TOKENS_PER_REQUEST = Math.floor(GEMINI_CONTEXT_WINDOW * SAFETY_MARGIN);

/**
 * Chunking constants
 * Invoice pages (1-2) are always included in each chunk
 */
const INVOICE_PAGES = 2; // First 2 pages are assumed to be the invoice
const PAGES_PER_CHUNK =
  Math.floor(MAX_TOKENS_PER_REQUEST / TOKENS_PER_PAGE_ESTIMATE) - INVOICE_PAGES;

/**
 * Result of logistics document processing
 */
export interface LogisticsProcessingResult {
  logisticsDocumentId: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  wasChunked: boolean;
  chunkCount?: number;
  processingTimeMs: number;
  result?: Partial<LogisticsDocument>;
  error?: string;
}

/**
 * Chunk information for processing
 */
interface PdfChunk {
  chunkIndex: number;
  startPage: number; // 0-based
  endPage: number; // 0-based, exclusive
  buffer: Buffer;
}

/**
 * Logistics Processing Service
 */
export class LogisticsProcessingService {
  /**
   * Calculates SHA-256 hash of a buffer
   */
  private calculateHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Estimates token count for a PDF based on page count
   */
  estimateTokens(pageCount: number): number {
    return pageCount * TOKENS_PER_PAGE_ESTIMATE;
  }

  /**
   * Checks if document fits within Gemini's context window
   */
  fitsContextWindow(pageCount: number): boolean {
    return this.estimateTokens(pageCount) <= MAX_TOKENS_PER_REQUEST;
  }

  /**
   * Checks if a document with the same hash already exists
   */
  async checkDuplicate(hash: string): Promise<LogisticsDocument | null> {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "LogisticsProcessingService.ts:checkDuplicate:entry",
        message: "checkDuplicate called",
        data: { hash },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    console.error("[DEBUG] checkDuplicate called with hash:", hash);
    // #endregion
    try {
      const client = requireDirectus();
      const existing = await client.request(
        readItems("logistics_documents", {
          filter: {
            hash_sha256: { _eq: hash },
          },
          limit: 1,
        })
      );
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "LogisticsProcessingService.ts:checkDuplicate:success",
          message: "checkDuplicate query succeeded",
          data: { existingCount: existing?.length || 0 },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "A",
        }),
      }).catch(() => {});
      console.error("[DEBUG] checkDuplicate success, existing count:", existing?.length || 0);
      // #endregion

      if (existing && existing.length > 0) {
        return existing[0] as LogisticsDocument;
      }
      return null;
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "LogisticsProcessingService.ts:checkDuplicate:error",
          message: "checkDuplicate error caught",
          data: {
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            errorMessage: error instanceof Error ? error.message : "unknown",
            errorString: String(error),
            errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "A,D",
        }),
      }).catch(() => {});
      console.error("[DEBUG] checkDuplicate error:", {
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : "unknown",
        errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      // #endregion
      logger.warn("[LogisticsProcessingService] Error checking duplicate", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Creates a logistics document record
   */
  async createLogisticsDocument(params: Partial<LogisticsDocument>): Promise<LogisticsDocument> {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "LogisticsProcessingService.ts:createLogisticsDocument:entry",
        message: "createLogisticsDocument called",
        data: { title: params.title, hasFile: !!params.file },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    console.error("[DEBUG] createLogisticsDocument called with title:", params.title);
    // #endregion
    const client = requireDirectus();
    const id = params.id || uuidv4();

    const document: Partial<LogisticsDocument> = {
      ...params,
      id,
      created_at: new Date().toISOString(),
    };

    try {
      const created = await client.request(
        createItem("logistics_documents", document as LogisticsDocument)
      );
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "LogisticsProcessingService.ts:createLogisticsDocument:success",
          message: "Document created successfully",
          data: { id },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "B",
        }),
      }).catch(() => {});
      console.error("[DEBUG] createLogisticsDocument success, id:", id);
      // #endregion

      logger.info("[LogisticsProcessingService] Logistics document created", {
        id,
        title: params.title,
      });

      return created as LogisticsDocument;
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "LogisticsProcessingService.ts:createLogisticsDocument:error",
          message: "createLogisticsDocument error",
          data: {
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            errorMessage: error instanceof Error ? error.message : "unknown",
            errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "B,D",
        }),
      }).catch(() => {});
      console.error("[DEBUG] createLogisticsDocument error:", {
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : "unknown",
        errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      // #endregion

      // Check if this is a duplicate hash error - if so, return the existing document
      const errorJson = JSON.stringify(error, Object.getOwnPropertyNames(error));
      // #region agent log
      const duplicateCheck = {
        includesHasToBeUnique: errorJson.includes("has to be unique"),
        includesHashSha256: errorJson.includes("hash_sha256"),
        hasParamsHash: !!params.hash_sha256,
        paramsHash: params.hash_sha256,
      };
      fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "LogisticsProcessingService.ts:createLogisticsDocument:duplicateCheck",
          message: "Checking duplicate conditions",
          data: duplicateCheck,
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "E",
        }),
      }).catch(() => {});
      console.error("[DEBUG] duplicateCheck:", duplicateCheck);
      // #endregion
      if (
        errorJson.includes("has to be unique") &&
        errorJson.includes("hash_sha256") &&
        params.hash_sha256
      ) {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "LogisticsProcessingService.ts:createLogisticsDocument:duplicateDetected",
            message: "Duplicate detected, fetching existing",
            data: { hash: params.hash_sha256 },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "E",
          }),
        }).catch(() => {});
        console.error(
          "[DEBUG] Duplicate detected, fetching existing with hash:",
          params.hash_sha256
        );
        // #endregion
        logger.info(
          "[LogisticsProcessingService] Document with same hash already exists, fetching existing",
          {
            hash: params.hash_sha256,
          }
        );
        const existing = await this.checkDuplicate(params.hash_sha256);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "LogisticsProcessingService.ts:createLogisticsDocument:existingResult",
            message: "checkDuplicate result",
            data: { found: !!existing, existingId: existing?.id },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "E",
          }),
        }).catch(() => {});
        console.error("[DEBUG] checkDuplicate result:", {
          found: !!existing,
          existingId: existing?.id,
        });
        // #endregion
        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  /**
   * Updates a logistics document
   */
  async updateLogisticsDocument(
    id: string,
    updates: Partial<LogisticsDocument>
  ): Promise<LogisticsDocument> {
    const client = requireDirectus();

    const updated = await client.request(
      updateItem("logistics_documents", id, {
        ...updates,
        updated_at: new Date().toISOString(),
      } as LogisticsDocument)
    );

    return updated as LogisticsDocument;
  }

  /**
   * Gets page count from a PDF buffer
   */
  async getPdfPageCount(buffer: Buffer): Promise<number> {
    const pdfDoc = await PDFDocument.load(buffer);
    return pdfDoc.getPageCount();
  }

  /**
   * Splits a PDF into chunks, keeping invoice pages in each chunk
   */
  async splitPdfIntoChunks(buffer: Buffer, pageCount: number): Promise<PdfChunk[]> {
    const pdfDoc = await PDFDocument.load(buffer);
    const chunks: PdfChunk[] = [];

    // Calculate how many supporting document pages per chunk
    const supportingPages = pageCount - INVOICE_PAGES;
    const numChunks = Math.ceil(supportingPages / PAGES_PER_CHUNK);

    logger.info("[LogisticsProcessingService] Splitting PDF into chunks", {
      totalPages: pageCount,
      invoicePages: INVOICE_PAGES,
      supportingPages,
      pagesPerChunk: PAGES_PER_CHUNK,
      numChunks,
    });

    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkDoc = await PDFDocument.create();

      // Always include invoice pages (pages 0 and 1)
      const invoicePagesToCopy = await chunkDoc.copyPages(
        pdfDoc,
        Array.from({ length: Math.min(INVOICE_PAGES, pageCount) }, (_, i) => i)
      );
      invoicePagesToCopy.forEach((page) => chunkDoc.addPage(page));

      // Calculate which supporting pages to include in this chunk
      const startSupportingPage = INVOICE_PAGES + chunkIndex * PAGES_PER_CHUNK;
      const endSupportingPage = Math.min(startSupportingPage + PAGES_PER_CHUNK, pageCount);

      if (startSupportingPage < pageCount) {
        const supportingPageIndices = Array.from(
          { length: endSupportingPage - startSupportingPage },
          (_, i) => startSupportingPage + i
        );

        const supportingPagesToCopy = await chunkDoc.copyPages(pdfDoc, supportingPageIndices);
        supportingPagesToCopy.forEach((page) => chunkDoc.addPage(page));
      }

      const chunkBytes = await chunkDoc.save();
      chunks.push({
        chunkIndex,
        startPage: startSupportingPage,
        endPage: endSupportingPage,
        buffer: Buffer.from(chunkBytes),
      });

      logger.debug("[LogisticsProcessingService] Created chunk", {
        chunkIndex,
        startPage: startSupportingPage,
        endPage: endSupportingPage,
        chunkPages: chunkDoc.getPageCount(),
      });
    }

    return chunks;
  }

  /**
   * Processes a single PDF with the logistics prompt
   */
  async processWithLLM(buffer: Buffer): Promise<Record<string, unknown>> {
    const arrayBuffer = new Uint8Array(buffer).buffer;
    const result = await validatePdfContentWithGemini(arrayBuffer, "logistics");

    // The result contains extracted_data which has the logistics-specific structure
    // For logistics, the main result is in the response structure itself
    return result as unknown as Record<string, unknown>;
  }

  /**
   * Merges results from multiple chunks into a single result
   */
  mergeChunkResults(chunkResults: Array<Record<string, unknown>>): Partial<LogisticsDocument> {
    if (chunkResults.length === 0) {
      return {};
    }

    if (chunkResults.length === 1) {
      return this.extractLogisticsResult(chunkResults[0]);
    }

    // Take invoice header from first chunk (should be consistent across all)
    const firstResult = this.extractLogisticsResult(chunkResults[0]);
    const merged: Partial<LogisticsDocument> = {
      invoice_header: firstResult.invoice_header,
      transport_line_items: [],
      unclaimed_documents: [],
      present_fields: [],
      missing_fields: [],
      confidence: 0,
    };

    // Merge line items and unclaimed documents from all chunks
    const seenLineIds = new Set<number>();
    let totalConfidence = 0;
    const allPresentFields = new Set<string>();
    const allMissingFields = new Set<string>();

    for (const chunkResult of chunkResults) {
      const result = this.extractLogisticsResult(chunkResult);

      // Merge transport line items (avoid duplicates by line_id)
      if (result.transport_line_items) {
        for (const item of result.transport_line_items) {
          if (item.line_id && !seenLineIds.has(item.line_id)) {
            seenLineIds.add(item.line_id);
            merged.transport_line_items!.push(item);
          } else if (item.line_id && seenLineIds.has(item.line_id)) {
            // Merge associated documents for existing line item
            const existingItem = merged.transport_line_items!.find(
              (i) => i.line_id === item.line_id
            );
            if (existingItem && item.associated_documents) {
              existingItem.associated_documents = [
                ...(existingItem.associated_documents || []),
                ...item.associated_documents,
              ];
              // Update match status if we found documents
              if (item.match_status === "Matched") {
                existingItem.match_status = "Matched";
                existingItem.match_reason = item.match_reason;
              }
            }
          }
        }
      }

      // Merge unclaimed documents
      if (result.unclaimed_documents) {
        merged.unclaimed_documents!.push(...result.unclaimed_documents);
      }

      // Aggregate confidence
      if (result.confidence) {
        totalConfidence += result.confidence;
      }

      // Merge present/missing fields
      if (result.present_fields) {
        result.present_fields.forEach((f) => allPresentFields.add(f));
      }
      if (result.missing_fields) {
        result.missing_fields.forEach((f) => allMissingFields.add(f));
      }
    }

    merged.confidence = totalConfidence / chunkResults.length;
    merged.present_fields = Array.from(allPresentFields);
    merged.missing_fields = Array.from(allMissingFields);

    return merged;
  }

  /**
   * Extracts logistics-specific fields from LLM result
   */
  private extractLogisticsResult(result: Record<string, unknown>): Partial<LogisticsDocument> {
    // The LLM response structure matches LogisticsDocument structure
    return {
      invoice_header: result.invoice_header as LogisticsDocument["invoice_header"],
      transport_line_items:
        result.transport_line_items as LogisticsDocument["transport_line_items"],
      unclaimed_documents: result.unclaimed_documents as LogisticsDocument["unclaimed_documents"],
      confidence: result.confidence as number,
      present_fields: result.present_fields as string[],
      missing_fields: result.missing_fields as string[],
    };
  }

  /**
   * Main processing method - handles the complete logistics document workflow
   */
  async processDocument(params: {
    filename: string;
    buffer: Buffer;
    mimetype: string;
  }): Promise<LogisticsProcessingResult> {
    const { filename, buffer, mimetype } = params;
    const startTime = Date.now();

    logger.info("[LogisticsProcessingService] Starting document processing", {
      filename,
      size: buffer.length,
    });

    try {
      // 1. Calculate hash and check for duplicate
      const hash = this.calculateHash(buffer);
      const existingDoc = await this.checkDuplicate(hash);

      if (existingDoc && existingDoc.processing_status === "completed") {
        logger.info("[LogisticsProcessingService] Document is a duplicate", {
          filename,
          existingId: existingDoc.id,
        });

        return {
          logisticsDocumentId: existingDoc.id!,
          isDuplicate: true,
          duplicateOf: existingDoc.id,
          wasChunked: existingDoc.was_chunked || false,
          processingTimeMs: Date.now() - startTime,
          result: existingDoc,
        };
      }

      // 2. Upload file to Directus
      const uploadedFile = await directusDocumentService.uploadFile({
        filename,
        buffer,
        mimetype,
        title: `Logistics: ${filename}`,
      });

      // 3. Create logistics document record
      const logisticsDoc = await this.createLogisticsDocument({
        title: filename,
        file: uploadedFile.id,
        hash_sha256: hash,
        processing_status: "processing",
      });

      // 4. Get page count and estimate tokens
      const pageCount = await this.getPdfPageCount(buffer);
      const estimatedTokens = this.estimateTokens(pageCount);
      const fitsContext = this.fitsContextWindow(pageCount);

      logger.info("[LogisticsProcessingService] Document analysis", {
        filename,
        pageCount,
        estimatedTokens,
        fitsContext,
        maxTokens: MAX_TOKENS_PER_REQUEST,
      });

      await this.updateLogisticsDocument(logisticsDoc.id!, {
        token_count: estimatedTokens,
      });

      let result: Partial<LogisticsDocument>;
      let wasChunked = false;
      let chunkCount = 1;
      let llmResult: Record<string, unknown>;

      if (fitsContext) {
        // 5a. Process entire document
        logger.info("[LogisticsProcessingService] Processing entire document", {
          filename,
          pageCount,
        });

        llmResult = await this.processWithLLM(buffer);
        result = this.extractLogisticsResult(llmResult);
      } else {
        // 5b. Split and process in chunks
        logger.info("[LogisticsProcessingService] Document too large, chunking", {
          filename,
          pageCount,
          estimatedTokens,
        });

        wasChunked = true;
        const chunks = await this.splitPdfIntoChunks(buffer, pageCount);
        chunkCount = chunks.length;

        await this.updateLogisticsDocument(logisticsDoc.id!, {
          was_chunked: true,
          chunk_count: chunkCount,
        });

        const chunkResults: Array<Record<string, unknown>> = [];

        for (const chunk of chunks) {
          logger.info("[LogisticsProcessingService] Processing chunk", {
            chunkIndex: chunk.chunkIndex,
            startPage: chunk.startPage,
            endPage: chunk.endPage,
          });

          try {
            const chunkResult = await this.processWithLLM(chunk.buffer);
            chunkResults.push(chunkResult);
          } catch (chunkError) {
            logger.error("[LogisticsProcessingService] Chunk processing failed", {
              chunkIndex: chunk.chunkIndex,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
            });
            // Continue with other chunks
          }
        }

        result = this.mergeChunkResults(chunkResults);
        // Store merged result as llmResult for response saving
        llmResult = {
          ...result,
          was_chunked: true,
          chunk_count: chunkCount,
        };
      }

      // 5c. Save LLM response to responses collection
      const response = await directusDocumentService.createResponse({
        logisticsDocumentId: logisticsDoc.id!,
        responseJson: llmResult,
        modelName: "gemini-2.5-flash",
        status: "completed",
      });

      logger.info("[LogisticsProcessingService] LLM response saved", {
        responseId: response.id,
        logisticsDocumentId: logisticsDoc.id,
      });

      // 6. Update document with results and link to response
      const processingTimeMs = Date.now() - startTime;
      await this.updateLogisticsDocument(logisticsDoc.id!, {
        ...result,
        response: response.id,
        processing_status: "completed",
        was_chunked: wasChunked,
        chunk_count: chunkCount,
        processing_time_ms: processingTimeMs,
      });

      logger.info("[LogisticsProcessingService] Document processing completed", {
        filename,
        logisticsDocumentId: logisticsDoc.id,
        wasChunked,
        chunkCount,
        processingTimeMs,
      });

      return {
        logisticsDocumentId: logisticsDoc.id!,
        isDuplicate: false,
        wasChunked,
        chunkCount,
        processingTimeMs,
        result,
      };
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "LogisticsProcessingService.ts:processDocument:catch",
          message: "Main catch block reached",
          data: {
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            errorMessage: error instanceof Error ? error.message : "unknown",
            errorStack: error instanceof Error ? error.stack : "no stack",
            errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "C,D",
        }),
      }).catch(() => {});
      // #endregion
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error("[LogisticsProcessingService] Document processing failed", {
        filename,
        error: errorMessage,
        stack: errorStack,
        errorType: error?.constructor?.name,
      });

      throw new Error(`Logistics document processing failed: ${errorMessage}`);
    }
  }

  /**
   * Reprocesses an existing logistics document, creating a new response
   */
  async reprocessDocument(documentId: string): Promise<{
    responseId: string;
    wasChunked: boolean;
    chunkCount?: number;
    processingTimeMs: number;
    result?: Partial<LogisticsDocument>;
  }> {
    const startTime = Date.now();

    logger.info("[LogisticsProcessingService] Starting document reprocess", {
      documentId,
    });

    // Get the existing document
    const document = await this.getLogisticsDocument(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Get the file from Directus
    if (!document.file) {
      throw new Error(`Document has no associated file: ${documentId}`);
    }

    const fileBuffer = await directusDocumentService.downloadFile(document.file);
    if (!fileBuffer) {
      throw new Error(`Could not retrieve file for document: ${documentId}`);
    }

    // Update status to processing
    await this.updateLogisticsDocument(documentId, {
      processing_status: "processing",
    });

    try {
      // Get page count
      const pageCount = await this.getPdfPageCount(fileBuffer);
      const fitsContext = this.fitsContextWindow(pageCount);

      let result: Partial<LogisticsDocument>;
      let wasChunked = false;
      let chunkCount = 1;
      let llmResult: Record<string, unknown>;

      if (fitsContext) {
        llmResult = await this.processWithLLM(fileBuffer);
        result = this.extractLogisticsResult(llmResult);
      } else {
        wasChunked = true;
        const chunks = await this.splitPdfIntoChunks(fileBuffer, pageCount);
        chunkCount = chunks.length;

        const chunkResults: Array<Record<string, unknown>> = [];
        for (const chunk of chunks) {
          try {
            const chunkResult = await this.processWithLLM(chunk.buffer);
            chunkResults.push(chunkResult);
          } catch (chunkError) {
            logger.error("[LogisticsProcessingService] Chunk processing failed during reprocess", {
              chunkIndex: chunk.chunkIndex,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
            });
          }
        }

        result = this.mergeChunkResults(chunkResults);
        llmResult = { ...result, was_chunked: true, chunk_count: chunkCount };
      }

      // Create new response in responses collection with logistics_document reference
      const client = requireDirectus();
      const responseId = uuidv4();
      await client.request(
        createItem("responses", {
          id: responseId,
          logistics_document: documentId,
          response_json: llmResult,
          model_name: "gemini-2.5-flash",
          status: "completed",
          created_at: new Date().toISOString(),
        })
      );

      logger.info("[LogisticsProcessingService] New response created for reprocess", {
        responseId,
        documentId,
      });

      // Update document with new results
      const processingTimeMs = Date.now() - startTime;
      await this.updateLogisticsDocument(documentId, {
        ...result,
        processing_status: "completed",
        was_chunked: wasChunked,
        chunk_count: chunkCount,
        processing_time_ms: processingTimeMs,
      });

      logger.info("[LogisticsProcessingService] Document reprocessing completed", {
        documentId,
        responseId,
        wasChunked,
        chunkCount,
        processingTimeMs,
      });

      return {
        responseId,
        wasChunked,
        chunkCount,
        processingTimeMs,
        result,
      };
    } catch (error) {
      // Mark as failed
      await this.updateLogisticsDocument(documentId, {
        processing_status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets a logistics document by ID
   */
  async getLogisticsDocument(id: string): Promise<LogisticsDocument | null> {
    try {
      const client = requireDirectus();
      const results = await client.request(
        readItems("logistics_documents", {
          filter: { id: { _eq: id } },
          limit: 1,
        })
      );

      if (results && results.length > 0) {
        return results[0] as LogisticsDocument;
      }
      return null;
    } catch (error) {
      logger.warn("[LogisticsProcessingService] Error getting document", {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

// Export singleton instance
export const logisticsProcessingService = new LogisticsProcessingService();
