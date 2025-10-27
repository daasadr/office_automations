/**
 * Directus Document Service
 * Handles CRUD operations for document-related collections in Directus
 */

import { createItem, readItems, updateItem, uploadFiles, readAssetRaw } from "@directus/sdk";
import { createHash } from "crypto";
import { requireDirectus } from "@orchestration-api/lib/directus/client";
import { logger } from "@orchestration-api/utils/logger";
import type {
  SourceDocument,
  Response,
  GeneratedDocument,
  DirectusFile,
  FoundationDocument,
} from "@orchestration-api/lib/directus/types";

/**
 * File Upload Options
 */
interface FileUploadOptions {
  filename: string;
  buffer: Buffer;
  mimetype: string;
  title?: string;
}

/**
 * Source Document Creation Options
 */
interface CreateSourceDocumentOptions {
  title: string;
  file: FileUploadOptions;
  processingStatus?: SourceDocument["processing_status"];
}

/**
 * Response Creation Options
 */
interface CreateResponseOptions {
  sourceDocumentId: string;
  prompt?: string;
  responseText?: string;
  responseJson?: Record<string, unknown>;
  modelName?: string;
  tokenCount?: number;
  processingTimeMs?: number;
  status?: Response["status"];
  errorMessage?: string;
}

/**
 * Generated Document Creation Options
 */
interface CreateGeneratedDocumentOptions {
  responseId: string;
  file: FileUploadOptions;
  documentType?: GeneratedDocument["document_type"];
  generationParams?: Record<string, unknown>;
  generationStatus?: GeneratedDocument["generation_status"];
  errorMessage?: string;
}

/**
 * Service class for managing documents in Directus
 */
export class DirectusDocumentService {
  /**
   * Calculates SHA-256 hash of a buffer
   */
  private calculateHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Uploads a file to Directus
   */
  async uploadFile(options: FileUploadOptions): Promise<DirectusFile> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting file upload", {
      operation: "uploadFile",
      filename: options.filename,
      mimetype: options.mimetype,
      size: options.buffer.length,
    });

    try {
      const client = requireDirectus();

      // Create FormData for file upload
      const formData = new FormData();
      const blob = new Blob([options.buffer], { type: options.mimetype });
      formData.append("file", blob, options.filename);

      if (options.title) {
        formData.append("title", options.title);
      }

      // Upload file using Directus SDK
      const result = await client.request(uploadFiles(formData));

      // SUCCESS LOG
      logger.info("[Directus] File upload completed successfully", {
        operation: "uploadFile",
        fileId: result.id,
        filename: result.filename_download,
        size: result.filesize,
      });

      return result as unknown as DirectusFile;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] File upload failed", {
        operation: "uploadFile",
        filename: options.filename,
        mimetype: options.mimetype,
        size: options.buffer.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Creates a source document record and uploads the associated file
   */
  async createSourceDocument(options: CreateSourceDocumentOptions): Promise<SourceDocument> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to create source document", {
      operation: "createSourceDocument",
      title: options.title,
      mimetype: options.file.mimetype,
      size: options.file.buffer.length,
      processingStatus: options.processingStatus || "uploaded",
    });

    try {
      const client = requireDirectus();

      // Upload file first
      const uploadedFile = await this.uploadFile({
        ...options.file,
        title: options.title,
      });

      // Calculate file hash for deduplication
      const hash = this.calculateHash(options.file.buffer);

      // Check if document with same hash already exists
      const existing = await client.request(
        readItems("source_documents", {
          filter: {
            hash_sha256: { _eq: hash },
          },
          limit: 1,
        })
      );

      if (existing && existing.length > 0) {
        const existingDoc = existing[0];
        logger.warn(
          "[Directus] Source document with same hash already exists - returning existing",
          {
            operation: "createSourceDocument",
            existingId: existingDoc.id,
            hash,
            title: options.title,
          }
        );

        // Update processing status if needed
        if (
          options.processingStatus &&
          existingDoc.processing_status !== options.processingStatus &&
          existingDoc.id
        ) {
          await client.request(
            updateItem("source_documents", existingDoc.id, {
              processing_status: options.processingStatus,
            })
          );
          logger.info("[Directus] Updated processing status of existing document", {
            operation: "createSourceDocument",
            documentId: existingDoc.id,
            status: options.processingStatus,
          });
        }

        return existingDoc as SourceDocument;
      }

      // Create source document record
      const sourceDocument: Partial<SourceDocument> = {
        title: options.title,
        file: uploadedFile.id,
        hash_sha256: hash,
        mime_type: options.file.mimetype,
        bytes: options.file.buffer.length,
        processing_status: options.processingStatus || "uploaded",
      };

      const created = await client.request(createItem("source_documents", sourceDocument));

      // SUCCESS LOG
      logger.info("[Directus] Source document created successfully", {
        operation: "createSourceDocument",
        documentId: created.id,
        title: options.title,
        fileId: uploadedFile.id,
        hash: hash,
        processingStatus: sourceDocument.processing_status,
      });

      return created as SourceDocument;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Source document creation failed", {
        operation: "createSourceDocument",
        title: options.title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Source document creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Updates source document status
   */
  async updateSourceDocumentStatus(
    documentId: string,
    status: SourceDocument["processing_status"]
  ): Promise<SourceDocument> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to update source document status", {
      operation: "updateSourceDocumentStatus",
      documentId,
      newStatus: status,
    });

    try {
      const client = requireDirectus();

      const updated = await client.request(
        updateItem("source_documents", documentId, {
          processing_status: status,
        })
      );

      // SUCCESS LOG
      logger.info("[Directus] Source document status updated successfully", {
        operation: "updateSourceDocumentStatus",
        documentId,
        status,
      });

      return updated as SourceDocument;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Source document status update failed", {
        operation: "updateSourceDocumentStatus",
        documentId,
        status,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Source document status update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Creates a response record for LLM processing results
   */
  async createResponse(options: CreateResponseOptions): Promise<Response> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to create response record", {
      operation: "createResponse",
      sourceDocumentId: options.sourceDocumentId,
      modelName: options.modelName,
      status: options.status || "completed",
      hasPrompt: !!options.prompt,
      hasResponseText: !!options.responseText,
      hasResponseJson: !!options.responseJson,
      tokenCount: options.tokenCount,
      processingTimeMs: options.processingTimeMs,
    });

    try {
      const client = requireDirectus();

      const response: Partial<Response> = {
        source_document: options.sourceDocumentId,
        prompt: options.prompt,
        response_text: options.responseText,
        response_json: options.responseJson,
        model_name: options.modelName,
        token_count: options.tokenCount,
        processing_time_ms: options.processingTimeMs,
        status: options.status || "completed",
        error_message: options.errorMessage,
      };

      const created = await client.request(createItem("responses", response));

      // SUCCESS LOG
      logger.info("[Directus] Response record created successfully", {
        operation: "createResponse",
        responseId: created.id,
        sourceDocumentId: options.sourceDocumentId,
        status: response.status,
        modelName: options.modelName,
      });

      return created as Response;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Response creation failed", {
        operation: "createResponse",
        sourceDocumentId: options.sourceDocumentId,
        modelName: options.modelName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Response creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Updates response status
   */
  async updateResponseStatus(
    responseId: string,
    status: Response["status"],
    errorMessage?: string
  ): Promise<Response> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to update response status", {
      operation: "updateResponseStatus",
      responseId,
      newStatus: status,
      hasErrorMessage: !!errorMessage,
    });

    try {
      const client = requireDirectus();

      const updated = await client.request(
        updateItem("responses", responseId, {
          status,
          error_message: errorMessage,
        })
      );

      // SUCCESS LOG
      logger.info("[Directus] Response status updated successfully", {
        operation: "updateResponseStatus",
        responseId,
        status,
      });

      return updated as Response;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Response status update failed", {
        operation: "updateResponseStatus",
        responseId,
        status,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Response status update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Creates a generated document record and uploads the file
   */
  async createGeneratedDocument(
    options: CreateGeneratedDocumentOptions
  ): Promise<GeneratedDocument> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to create generated document", {
      operation: "createGeneratedDocument",
      responseId: options.responseId,
      documentType: options.documentType || "excel",
      filename: options.file.filename,
      mimetype: options.file.mimetype,
      size: options.file.buffer.length,
      generationStatus: options.generationStatus || "completed",
    });

    try {
      const client = requireDirectus();

      // Upload generated file
      const uploadedFile = await this.uploadFile({
        ...options.file,
        title: options.file.title || options.file.filename,
      });

      // Create generated document record
      const generatedDocument: Partial<GeneratedDocument> = {
        response_id: options.responseId,
        file: uploadedFile.id,
        document_type: options.documentType || "excel",
        mime_type: options.file.mimetype,
        bytes: options.file.buffer.length,
        generation_status: options.generationStatus || "completed",
        generation_params: options.generationParams,
        error_message: options.errorMessage,
      };

      const created = await client.request(createItem("generated_documents", generatedDocument));

      // SUCCESS LOG
      logger.info("[Directus] Generated document created successfully", {
        operation: "createGeneratedDocument",
        documentId: created.id,
        responseId: options.responseId,
        fileId: uploadedFile.id,
        documentType: generatedDocument.document_type,
        generationStatus: generatedDocument.generation_status,
      });

      return created as GeneratedDocument;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Generated document creation failed", {
        operation: "createGeneratedDocument",
        responseId: options.responseId,
        documentType: options.documentType,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Generated document creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Updates generated document status
   */
  async updateGeneratedDocumentStatus(
    documentId: string,
    status: GeneratedDocument["generation_status"],
    errorMessage?: string
  ): Promise<GeneratedDocument> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to update generated document status", {
      operation: "updateGeneratedDocumentStatus",
      documentId,
      newStatus: status,
      hasErrorMessage: !!errorMessage,
    });

    try {
      const client = requireDirectus();

      const updated = await client.request(
        updateItem("generated_documents", documentId, {
          generation_status: status,
          error_message: errorMessage,
        })
      );

      // SUCCESS LOG
      logger.info("[Directus] Generated document status updated successfully", {
        operation: "updateGeneratedDocumentStatus",
        documentId,
        status,
      });

      return updated as GeneratedDocument;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Generated document status update failed", {
        operation: "updateGeneratedDocumentStatus",
        documentId,
        status,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Generated document status update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Retrieves a source document by ID
   */
  async getSourceDocument(documentId: string): Promise<SourceDocument | null> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to retrieve source document", {
      operation: "getSourceDocument",
      documentId,
    });

    try {
      const client = requireDirectus();

      const documents = await client.request(
        readItems("source_documents", {
          filter: {
            id: { _eq: documentId },
          },
          limit: 1,
        })
      );

      const result = documents && documents.length > 0 ? (documents[0] as SourceDocument) : null;

      // SUCCESS LOG
      if (result) {
        logger.info("[Directus] Source document retrieved successfully", {
          operation: "getSourceDocument",
          documentId,
          title: result.title,
          processingStatus: result.processing_status,
        });
      } else {
        logger.warn("[Directus] Source document not found", {
          operation: "getSourceDocument",
          documentId,
        });
      }

      return result;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to retrieve source document", {
        operation: "getSourceDocument",
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Retrieves a response by ID
   */
  async getResponse(responseId: string): Promise<Response | null> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to retrieve response", {
      operation: "getResponse",
      responseId,
    });

    try {
      const client = requireDirectus();

      const responses = await client.request(
        readItems("responses", {
          filter: {
            id: { _eq: responseId },
          },
          limit: 1,
        })
      );

      const result = responses && responses.length > 0 ? (responses[0] as Response) : null;

      // SUCCESS LOG
      if (result) {
        logger.info("[Directus] Response retrieved successfully", {
          operation: "getResponse",
          responseId,
          status: result.status,
          modelName: result.model_name,
        });
      } else {
        logger.warn("[Directus] Response not found", {
          operation: "getResponse",
          responseId,
        });
      }

      return result;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to retrieve response", {
        operation: "getResponse",
        responseId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Retrieves all responses for a source document
   */
  async getResponsesBySourceDocument(documentId: string): Promise<Response[]> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to retrieve responses for source document", {
      operation: "getResponsesBySourceDocument",
      documentId,
    });

    try {
      const client = requireDirectus();

      const responses = await client.request(
        readItems("responses", {
          filter: {
            source_document: { _eq: documentId },
          },
          sort: ["-created_at"],
        })
      );

      const result = (responses || []) as Response[];

      // SUCCESS LOG
      logger.info("[Directus] Responses retrieved successfully", {
        operation: "getResponsesBySourceDocument",
        documentId,
        count: result.length,
      });

      return result;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to retrieve responses for source document", {
        operation: "getResponsesBySourceDocument",
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Retrieves all generated documents for a response
   */
  async getGeneratedDocumentsByResponse(responseId: string): Promise<GeneratedDocument[]> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to retrieve generated documents for response", {
      operation: "getGeneratedDocumentsByResponse",
      responseId,
    });

    try {
      const client = requireDirectus();

      const documents = await client.request(
        readItems("generated_documents", {
          filter: {
            response_id: { _eq: responseId },
          },
          sort: ["-created_at"],
        })
      );

      const result = (documents || []) as GeneratedDocument[];

      // SUCCESS LOG
      logger.info("[Directus] Generated documents retrieved successfully", {
        operation: "getGeneratedDocumentsByResponse",
        responseId,
        count: result.length,
      });

      return result;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to retrieve generated documents for response", {
        operation: "getGeneratedDocumentsByResponse",
        responseId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Retrieves the last approved foundation document
   */
  async getLastApprovedFoundationDocument(): Promise<FoundationDocument | null> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to retrieve last approved foundation document", {
      operation: "getLastApprovedFoundationDocument",
    });

    try {
      const client = requireDirectus();

      const documents = await client.request(
        readItems("foundation_documents", {
          filter: {
            status: { _eq: "approved" },
          },
          sort: ["-created_at"],
          limit: 1,
        })
      );

      const result =
        documents && documents.length > 0 ? (documents[0] as FoundationDocument) : null;

      // SUCCESS LOG
      if (result) {
        logger.info("[Directus] Last approved foundation document retrieved successfully", {
          operation: "getLastApprovedFoundationDocument",
          documentId: result.id,
          title: result.title,
        });
      } else {
        logger.warn("[Directus] No approved foundation document found", {
          operation: "getLastApprovedFoundationDocument",
        });
      }

      return result;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to retrieve last approved foundation document", {
        operation: "getLastApprovedFoundationDocument",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Retrieves a foundation document by ID
   */
  async getFoundationDocument(documentId: string): Promise<FoundationDocument | null> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to retrieve foundation document", {
      operation: "getFoundationDocument",
      documentId,
    });

    try {
      const client = requireDirectus();

      const documents = await client.request(
        readItems("foundation_documents", {
          filter: {
            id: { _eq: documentId },
          },
          limit: 1,
        })
      );

      const result =
        documents && documents.length > 0 ? (documents[0] as FoundationDocument) : null;

      // SUCCESS LOG
      if (result) {
        logger.info("[Directus] Foundation document retrieved successfully", {
          operation: "getFoundationDocument",
          documentId: result.id,
          title: result.title,
          status: result.status,
        });
      } else {
        logger.warn("[Directus] Foundation document not found", {
          operation: "getFoundationDocument",
          documentId,
        });
      }

      return result;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to retrieve foundation document", {
        operation: "getFoundationDocument",
        documentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Downloads a file from Directus by file ID
   */
  async downloadFile(fileId: string): Promise<Buffer | null> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to download file", {
      operation: "downloadFile",
      fileId,
    });

    try {
      const client = requireDirectus();

      // Download file as raw stream
      const fileStream = await client.request(readAssetRaw(fileId));

      // Convert ReadableStream to Buffer
      const reader = fileStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      // Concatenate all chunks into a single buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const buffer = Buffer.alloc(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      // SUCCESS LOG
      logger.info("[Directus] File downloaded successfully", {
        operation: "downloadFile",
        fileId,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Failed to download file", {
        operation: "downloadFile",
        fileId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Creates a foundation document record and uploads the associated file
   */
  async createFoundationDocument(options: {
    title: string;
    file: FileUploadOptions;
    sourceDocumentId?: string;
    docType?: string;
    status?: FoundationDocument["status"];
    contentJson?: Record<string, unknown>;
    notes?: string;
  }): Promise<FoundationDocument> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to create foundation document", {
      operation: "createFoundationDocument",
      title: options.title,
      mimetype: options.file.mimetype,
      size: options.file.buffer.length,
      status: options.status || "draft",
    });

    try {
      const client = requireDirectus();

      // Upload file first
      const uploadedFile = await this.uploadFile({
        ...options.file,
        title: options.title,
      });

      // Create foundation document record
      const foundationDocument: Partial<FoundationDocument> = {
        title: options.title,
        file: uploadedFile.id,
        source_document: options.sourceDocumentId,
        doc_type: options.docType,
        status: options.status || "draft",
        content_json: options.contentJson,
        notes: options.notes,
      };

      const created = await client.request(createItem("foundation_documents", foundationDocument));

      // SUCCESS LOG
      logger.info("[Directus] Foundation document created successfully", {
        operation: "createFoundationDocument",
        documentId: created.id,
        title: options.title,
        fileId: uploadedFile.id,
        status: foundationDocument.status,
      });

      return created as FoundationDocument;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Foundation document creation failed", {
        operation: "createFoundationDocument",
        title: options.title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Foundation document creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Updates foundation document status
   */
  async updateFoundationDocumentStatus(
    documentId: string,
    status: FoundationDocument["status"]
  ): Promise<FoundationDocument> {
    // ATTEMPT LOG
    logger.info("[Directus] Attempting to update foundation document status", {
      operation: "updateFoundationDocumentStatus",
      documentId,
      newStatus: status,
    });

    try {
      const client = requireDirectus();

      const updated = await client.request(
        updateItem("foundation_documents", documentId, {
          status,
        })
      );

      // SUCCESS LOG
      logger.info("[Directus] Foundation document status updated successfully", {
        operation: "updateFoundationDocumentStatus",
        documentId,
        status,
      });

      return updated as FoundationDocument;
    } catch (error) {
      // ERROR LOG
      logger.error("[Directus] Foundation document status update failed", {
        operation: "updateFoundationDocumentStatus",
        documentId,
        status,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Foundation document status update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

/**
 * Singleton instance of the document service
 */
export const directusDocumentService = new DirectusDocumentService();
