import { Router } from "express";
import multer from "multer";
import { logger } from "../utils/logger";
import { validateDocumentContent } from "../services/llmService";
import { generateExcelFile, augmentExcelWithData } from "../services/excelService";
import {
  createJob,
  updateJob,
  getJob,
  completeJob,
  failJob,
  setJobExcel,
  generateJobId,
  getAllJobs,
} from "../services/jobService";
import { directusDocumentService, isDirectusAvailable } from "../lib/directus";
import type { Response } from "../lib/directus/types";
import type { LLMResponseSchema } from "../llmResponseSchema";

const router = Router();

// Helper function to filter responses by age (8 hours)
const RESPONSE_MAX_AGE_HOURS = 8;
const RESPONSE_MAX_AGE_MS = RESPONSE_MAX_AGE_HOURS * 60 * 60 * 1000;

// Minimal type for filtering responses by created_at
type FilterableResponse = Pick<Response, "id" | "created_at"> & Partial<Response>;

function filterRecentResponses<T extends FilterableResponse>(responses: T[]): T[] {
  const now = Date.now();
  const cutoffTime = now - RESPONSE_MAX_AGE_MS;

  return responses.filter((response) => {
    if (!response.created_at) return false;
    const responseTime = new Date(response.created_at).getTime();
    const isRecent = responseTime > cutoffTime;

    if (!isRecent) {
      logger.debug("Filtering out old response", {
        responseId: response.id,
        createdAt: response.created_at,
        ageHours: Math.round((now - responseTime) / (60 * 60 * 1000)),
        maxAgeHours: RESPONSE_MAX_AGE_HOURS,
      });
    }

    return isRecent;
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Please upload a PDF, CSV, or Excel file."));
    }
  },
});

// Upload and validate PDF document
router.post("/validate-pdf", upload.single("file"), async (req, res) => {
  try {
    logger.info("Starting PDF validation request");

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Use Gemini for PDF processing
    const provider = "gemini";

    logger.info("File received for validation", {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      provider: provider,
    });

    // Generate job ID and create job
    const jobId = generateJobId();
    createJob(jobId, req.file.originalname, req.file.size);

    // Step 1: Save file to Directus (if available) - REQUIRED
    let sourceDocumentId: string | undefined;
    if (isDirectusAvailable()) {
      try {
        logger.info("Saving source document to Directus", { jobId });
        const sourceDocument = await directusDocumentService.createSourceDocument({
          title: req.file.originalname,
          file: {
            filename: req.file.originalname,
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
          },
          processingStatus: "processing",
        });
        sourceDocumentId = sourceDocument.id;
        updateJob(jobId, { directusSourceDocumentId: sourceDocumentId });
        logger.info("Source document saved to Directus", {
          jobId,
          sourceDocumentId,
        });
      } catch (directusError) {
        logger.error("Failed to save source document to Directus", {
          jobId,
          error: directusError,
        });
        return res.status(500).json({
          error: "Failed to save document",
          details: directusError instanceof Error ? directusError.message : "Unknown error",
        });
      }
    } else {
      return res.status(503).json({
        error: "Directus is not available. Document upload requires Directus integration.",
      });
    }

    // Step 2: Return immediately with document ID
    logger.info("Document uploaded, returning document ID", {
      jobId,
      sourceDocumentId,
    });

    // Send response immediately
    res.json({
      success: true,
      jobId: jobId,
      provider: "gemini",
      directusSourceDocumentId: sourceDocumentId,
      status: "processing",
      message: "Document uploaded successfully. Processing started.",
    });

    // Step 3: Process asynchronously (don't await, let it run in background)
    // Using setImmediate to ensure response is sent first
    setImmediate(async () => {
      try {
        logger.info(`Starting async PDF processing with Gemini`, { jobId, sourceDocumentId });
        const startTime = Date.now();
        const validationResult = await validateDocumentContent(
          new Uint8Array(req.file!.buffer).buffer,
          { provider: "gemini" }
        );
        const processingTimeMs = Date.now() - startTime;

        // Complete the job
        completeJob(jobId, validationResult, "gemini");

        // Save LLM response to Directus
        try {
          logger.info("Saving LLM response to Directus", { jobId, sourceDocumentId });
          const response = await directusDocumentService.createResponse({
            sourceDocumentId: sourceDocumentId!,
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
          updateJob(jobId, { directusResponseId: response.id });

          // Update source document status
          await directusDocumentService.updateSourceDocumentStatus(sourceDocumentId!, "completed");

          logger.info("LLM response saved to Directus", {
            jobId,
            sourceDocumentId,
            responseId: response.id,
          });
        } catch (directusError) {
          logger.error("Failed to save LLM response to Directus", {
            jobId,
            sourceDocumentId,
            error: directusError,
          });
        }

        logger.info("PDF validation completed successfully with Gemini", {
          jobId,
          sourceDocumentId,
          processingTimeMs,
        });
      } catch (geminiError) {
        logger.error("Gemini PDF validation failed", {
          jobId,
          sourceDocumentId,
          error: geminiError,
        });
        failJob(
          jobId,
          geminiError instanceof Error ? geminiError.message : "PDF validation failed"
        );

        // Update Directus status
        try {
          await directusDocumentService.updateSourceDocumentStatus(sourceDocumentId!, "failed");
        } catch (directusError) {
          logger.warn("Failed to update source document status in Directus", {
            jobId,
            sourceDocumentId,
            error: directusError,
          });
        }
      }
    });
  } catch (error) {
    logger.error("Error processing PDF validation:", error);

    let errorMessage = "Došlo k chybě při zpracování souboru";
    if (error instanceof Error) {
      errorMessage = `Chyba: ${error.message}`;
    }

    res.status(500).json({
      error: errorMessage,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get document status by source document UUID (persists after restart)
// NOTE: This route MUST come before /status/:jobId to avoid matching confusion
router.get("/status-by-source/:sourceDocumentId", async (req, res) => {
  try {
    const { sourceDocumentId } = req.params;

    // Check if Directus is available
    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    logger.info("Fetching document status by source document ID", { sourceDocumentId });

    // Get source document
    const sourceDocument = await directusDocumentService.getSourceDocument(sourceDocumentId);
    if (!sourceDocument) {
      return res.status(404).json({
        error: "Source document not found",
        sourceDocumentId,
      });
    }

    // Get latest response for this source document (only recent ones within 8 hours)
    const allResponses =
      await directusDocumentService.getResponsesBySourceDocument(sourceDocumentId);
    const responses = filterRecentResponses(allResponses || []);

    let validationResult = null;
    if (responses && responses.length > 0) {
      // Sort by created_at to get the latest response
      const latestResponse = responses.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })[0];

      logger.info("Using recent response", {
        sourceDocumentId,
        responseId: latestResponse.id,
        responseAge: Math.round(
          (Date.now() - new Date(latestResponse.created_at || 0).getTime()) / (60 * 1000)
        ),
        ageUnit: "minutes",
      });

      if (latestResponse.response_json) {
        const responseData = latestResponse.response_json as any;
        // Only include validationResult if it has the required fields
        if (
          responseData.present !== undefined &&
          responseData.missing !== undefined &&
          responseData.confidence !== undefined
        ) {
          validationResult = responseData;
          logger.info("Valid response data found", {
            sourceDocumentId,
            responseId: latestResponse.id,
            hasExtractedData: !!responseData.extracted_data,
          });
        } else {
          logger.warn("Response data incomplete, treating as not ready", {
            sourceDocumentId,
            responseId: latestResponse.id,
            hasPresent: responseData.present !== undefined,
            hasMissing: responseData.missing !== undefined,
            hasConfidence: responseData.confidence !== undefined,
          });
        }
      }
    }

    // Return document status
    const response = {
      sourceDocumentId: sourceDocument.id,
      status: sourceDocument.processing_status || "completed",
      fileName: sourceDocument.title,
      fileSize: sourceDocument.bytes,
      createdAt: sourceDocument.created_at,
      updatedAt: sourceDocument.updated_at,
      directusSourceDocumentId: sourceDocument.id,
      validationResult: validationResult
        ? {
            present: validationResult.present,
            missing: validationResult.missing,
            confidence: validationResult.confidence,
            extracted_data: validationResult.extracted_data,
            provider: validationResult.provider,
          }
        : null,
    };

    logger.info("Returning document status", {
      sourceDocumentId,
      hasValidationResult: !!validationResult,
      status: response.status,
    });

    res.json(response);
  } catch (error) {
    logger.error("Error getting document status by source ID:", error);
    res.status(500).json({
      error: "Failed to get document status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get job status by job ID (in-memory, doesn't persist after restart)
router.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Return job status without sensitive data like buffers
    const response = {
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      provider: job.provider,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      directusSourceDocumentId: job.directusSourceDocumentId,
      // Include validation result but without image preview for status endpoint
      validationResult: job.validationResult
        ? {
            present: job.validationResult.present,
            missing: job.validationResult.missing,
            confidence: job.validationResult.confidence,
            extracted_data: job.validationResult.extracted_data,
            provider: job.validationResult.provider,
          }
        : undefined,
    };

    res.json(response);
  } catch (error) {
    logger.error("Error getting job status:", error);
    res.status(500).json({
      error: "Failed to get job status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Generate Excel file from job results
router.post("/generate-excel", async (req, res) => {
  try {
    const { documentId, jobId } = req.body;

    if (!documentId && !jobId) {
      return res.status(400).json({ error: "Document ID or Job ID is required" });
    }

    let validationResult = null;
    let identifier = documentId || jobId;

    // Try to get data from document UUID first (persists after restart)
    if (documentId && isDirectusAvailable()) {
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

          if (latestResponse.response_json) {
            validationResult = latestResponse.response_json as any;
            logger.info("Retrieved validation data from Directus", {
              documentId,
              responseId: latestResponse.id,
            });
          }
        }
      } catch (directusError) {
        logger.warn("Failed to fetch data from Directus, will try job ID", {
          documentId,
          error: directusError,
        });
      }
    }

    // Fall back to job ID if document UUID didn't work
    if (!validationResult && jobId) {
      const job = getJob(jobId);
      if (job && job.validationResult) {
        validationResult = job.validationResult;
        identifier = jobId;
        logger.info("Retrieved validation data from job", { jobId });
      }
    }

    if (!validationResult) {
      return res.status(404).json({
        error: "No validation data found",
        details: documentId
          ? "No response found for this document ID"
          : "No job found for this job ID",
      });
    }

    // Generate Excel file
    const excelResult = await generateExcelFile({
      jobId: identifier,
      validationResult,
    });

    if (!excelResult.success) {
      return res.status(500).json({
        error: "Failed to generate Excel file",
        details: excelResult.error,
      });
    }

    // Store Excel data in job (only if jobId was provided)
    if (jobId) {
      setJobExcel(jobId, excelResult.buffer, excelResult.filename);
    }

    // Save generated document to Directus (if available and we have document ID)
    if (isDirectusAvailable() && documentId) {
      try {
        // Get latest response to associate with generated document (only recent ones)
        const allResponses = await directusDocumentService.getResponsesBySourceDocument(documentId);
        const responses = filterRecentResponses(allResponses || []);

        if (responses && responses.length > 0) {
          const latestResponse = responses.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          })[0];

          logger.info("Saving generated document to Directus", {
            documentId,
            responseId: latestResponse.id,
          });
          const generatedDocument = await directusDocumentService.createGeneratedDocument({
            responseId: latestResponse.id!,
            file: {
              filename: excelResult.filename,
              buffer: excelResult.buffer,
              mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              title: `Generated Excel - ${excelResult.filename}`,
            },
            documentType: "excel",
            generationStatus: "completed",
            generationParams: {
              documentId,
              extractedDataCount: (validationResult as any).extracted_data?.length || 0,
              confidence: (validationResult as any).confidence || 0,
            },
          });
          logger.info("Generated document saved to Directus", {
            documentId,
            generatedDocumentId: generatedDocument.id,
          });
        }
      } catch (directusError) {
        logger.warn("Failed to save generated document to Directus", {
          documentId,
          error: directusError,
        });
      }
    } else if (isDirectusAvailable() && jobId) {
      // Try to save using job ID's associated document
      const job = getJob(jobId);
      if (job?.directusResponseId) {
        try {
          logger.info("Saving generated document to Directus", {
            jobId,
            responseId: job.directusResponseId,
          });
          const generatedDocument = await directusDocumentService.createGeneratedDocument({
            responseId: job.directusResponseId,
            file: {
              filename: excelResult.filename,
              buffer: excelResult.buffer,
              mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              title: `Generated Excel - ${excelResult.filename}`,
            },
            documentType: "excel",
            generationStatus: "completed",
            generationParams: {
              jobId,
              extractedDataCount: (validationResult as any).extracted_data?.length || 0,
              confidence: (validationResult as any).confidence || 0,
            },
          });
          updateJob(jobId, { directusGeneratedDocumentId: generatedDocument.id });
          logger.info("Generated document saved to Directus", {
            jobId,
            generatedDocumentId: generatedDocument.id,
          });
        } catch (directusError) {
          logger.warn("Failed to save generated document to Directus", {
            jobId,
            error: directusError,
          });
        }
      }
    }

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${excelResult.filename}"`,
      "Content-Length": excelResult.buffer.length.toString(),
    });

    res.send(excelResult.buffer);
  } catch (error) {
    logger.error("Error generating Excel file:", error);
    res.status(500).json({
      error: "Failed to generate Excel file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Download Excel file for a job
router.get("/download/:jobId/:filename", async (req, res) => {
  try {
    const { jobId, filename } = req.params;

    const job = getJob(jobId);
    if (!job || !job.excelBuffer || !job.excelFilename) {
      return res.status(404).json({ error: "Excel file not found for this job" });
    }

    // Verify filename matches (security check)
    if (job.excelFilename !== filename) {
      return res.status(404).json({ error: "File not found" });
    }

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${job.excelFilename}"`,
      "Content-Length": job.excelBuffer.length.toString(),
    });

    res.send(job.excelBuffer);
  } catch (error) {
    logger.error("Error downloading Excel file:", error);
    res.status(500).json({
      error: "Failed to download Excel file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Download Excel file by document UUID (persists after restart)
router.get("/download-by-doc/:documentId/:filename", async (req, res) => {
  try {
    const { documentId, filename } = req.params;

    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    logger.info("Downloading Excel by document ID", { documentId, filename });

    // Get latest response for this document (only recent ones within 8 hours)
    const allResponses = await directusDocumentService.getResponsesBySourceDocument(documentId);
    const responses = filterRecentResponses(allResponses || []);

    if (!responses || responses.length === 0) {
      return res.status(404).json({
        error: "No recent responses found for this document",
        message: `Responses must be within the last ${RESPONSE_MAX_AGE_HOURS} hours`,
      });
    }

    // Sort by created_at to get the latest response
    const latestResponse = responses.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];

    // Get generated documents for this response
    const generatedDocs = await directusDocumentService.getGeneratedDocumentsByResponse(
      latestResponse.id!
    );

    if (!generatedDocs || generatedDocs.length === 0) {
      // No generated document found, regenerate it
      logger.info("No generated document found, regenerating", { documentId });

      if (!latestResponse.response_json) {
        return res.status(404).json({
          error: "No response data found for this document",
        });
      }

      const validationResult = latestResponse.response_json as any;
      const excelResult = await generateExcelFile({
        jobId: documentId,
        validationResult,
      });

      if (!excelResult.success || !excelResult.buffer) {
        return res.status(500).json({
          error: "Failed to regenerate Excel file",
          details: excelResult.error,
        });
      }

      // Save the regenerated document to Directus
      try {
        await directusDocumentService.createGeneratedDocument({
          responseId: latestResponse.id!,
          file: {
            filename: excelResult.filename,
            buffer: excelResult.buffer,
            mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            title: `Generated Excel - ${excelResult.filename}`,
          },
          documentType: "excel",
          generationStatus: "completed",
          generationParams: {
            documentId,
            extractedDataCount: validationResult.extracted_data?.length || 0,
            confidence: validationResult.confidence || 0,
          },
        });
      } catch (saveError) {
        logger.warn("Failed to save regenerated document to Directus", {
          documentId,
          error: saveError,
        });
      }

      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${excelResult.filename}"`,
        "Content-Length": excelResult.buffer.length.toString(),
      });

      return res.send(excelResult.buffer);
    }

    // Download the most recent generated document
    const latestGenDoc = generatedDocs.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];

    if (!latestGenDoc.file) {
      return res.status(404).json({
        error: "Generated document has no file attached",
      });
    }

    const fileBuffer = await directusDocumentService.downloadFile(latestGenDoc.file);

    if (!fileBuffer) {
      return res.status(500).json({
        error: "Failed to download file from Directus",
      });
    }

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": fileBuffer.length.toString(),
    });

    res.send(fileBuffer);
  } catch (error) {
    logger.error("Error downloading Excel file by document ID:", error);
    res.status(500).json({
      error: "Failed to download Excel file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// List all jobs (for debugging/admin purposes)
router.get("/jobs", async (_req, res) => {
  try {
    const jobs = getAllJobs().map((job) => ({
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      provider: job.provider,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      hasExcel: !!job.excelBuffer,
    }));

    res.json({
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    logger.error("Error listing jobs:", error);
    res.status(500).json({
      error: "Failed to list jobs",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Process foundation document by augmenting it with extracted data from LLM response
 * Takes the last approved foundation document XLS file, adds extracted data to it,
 * and saves it back as a new draft foundation document
 */
router.post("/process-foundation", async (req, res) => {
  try {
    logger.info("Starting foundation document processing");

    const { jobId, responseId, sourceDocumentId } = req.body;

    if (!jobId && !responseId && !sourceDocumentId) {
      return res.status(400).json({
        error: "Either jobId, responseId, or sourceDocumentId is required",
      });
    }

    // Check if Directus is available
    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    // Get LLM response data
    let llmResponseData: LLMResponseSchema | null = null;
    let actualSourceDocumentId: string | undefined;
    let usedResponseId: string | undefined;

    if (sourceDocumentId) {
      // Get latest response for this source document (only recent ones within 8 hours)
      logger.info("Fetching latest response for source document", { sourceDocumentId });
      const allResponses =
        await directusDocumentService.getResponsesBySourceDocument(sourceDocumentId);
      const responses = filterRecentResponses(allResponses || []);

      if (!responses || responses.length === 0) {
        return res.status(404).json({
          error: "No recent responses found for this source document",
          sourceDocumentId,
          message: `Responses must be within the last ${RESPONSE_MAX_AGE_HOURS} hours`,
        });
      }

      // Sort by created_at to get the latest response
      const latestResponse = responses.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })[0];

      if (!latestResponse.response_json) {
        return res.status(404).json({
          error: "Latest response has no response data",
          responseId: latestResponse.id,
        });
      }

      llmResponseData = latestResponse.response_json as unknown as LLMResponseSchema;
      actualSourceDocumentId = sourceDocumentId;
      usedResponseId = latestResponse.id;

      logger.info("Using latest response", {
        responseId: latestResponse.id,
        sourceDocumentId,
        responseDate: latestResponse.created_at,
      });
    } else if (jobId) {
      // Get from job
      const job = getJob(jobId);
      if (!job || !job.validationResult) {
        return res.status(404).json({
          error: "Job not found or has no validation result",
        });
      }

      llmResponseData = job.validationResult as unknown as LLMResponseSchema;
      actualSourceDocumentId = job.directusSourceDocumentId;
    } else if (responseId) {
      // Get from Directus response
      const response = await directusDocumentService.getResponse(responseId);
      if (!response || !response.response_json) {
        return res.status(404).json({
          error: "Response not found or has no response data",
        });
      }

      llmResponseData = response.response_json as unknown as LLMResponseSchema;
      actualSourceDocumentId = response.source_document;
      usedResponseId = responseId;
    }

    if (!llmResponseData || !llmResponseData.extracted_data) {
      return res.status(400).json({
        error: "No extracted data found in LLM response",
      });
    }

    logger.info("Retrieved LLM response data", {
      extractedDataCount: llmResponseData.extracted_data.length,
      confidence: llmResponseData.confidence,
    });

    // Get last approved foundation document
    const lastApprovedDoc = await directusDocumentService.getLastApprovedFoundationDocument();

    if (!lastApprovedDoc) {
      return res.status(404).json({
        error: "No approved foundation document found",
        message:
          "Please ensure there is at least one foundation document with 'approved' status in Directus",
      });
    }

    if (!lastApprovedDoc.file) {
      return res.status(400).json({
        error: "Approved foundation document has no file attached",
        documentId: lastApprovedDoc.id,
      });
    }

    logger.info("Retrieved last approved foundation document", {
      documentId: lastApprovedDoc.id,
      title: lastApprovedDoc.title,
      fileId: lastApprovedDoc.file,
    });

    // Download the Excel file
    const excelBuffer = await directusDocumentService.downloadFile(lastApprovedDoc.file);

    if (!excelBuffer) {
      return res.status(500).json({
        error: "Failed to download foundation document file",
        documentId: lastApprovedDoc.id,
        fileId: lastApprovedDoc.file,
      });
    }

    logger.info("Downloaded foundation document file", {
      size: excelBuffer.length,
    });

    // Augment the Excel file with extracted data
    const augmentResult = await augmentExcelWithData(excelBuffer, llmResponseData.extracted_data);

    if (!augmentResult.success || !augmentResult.buffer) {
      return res.status(500).json({
        error: "Failed to augment Excel file",
        details: augmentResult.error,
      });
    }

    logger.info("Excel file augmented successfully", {
      sheetsModified: augmentResult.sheetsModified,
      bufferSize: augmentResult.buffer.length,
    });

    // Generate filename for the augmented document
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const newFilename = `${lastApprovedDoc.title.replace(/\.[^/.]+$/, "")}_augmented_${timestamp}.xlsx`;

    // Save as new draft foundation document
    const newFoundationDoc = await directusDocumentService.createFoundationDocument({
      title: `${lastApprovedDoc.title} (Augmented ${timestamp})`,
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
          sheetsModified: augmentResult.sheetsModified,
          confidence: llmResponseData.confidence,
        },
        augmentedAt: new Date().toISOString(),
      },
      notes: `Augmented from foundation document "${lastApprovedDoc.title}" with ${llmResponseData.extracted_data.length} extracted data items. Sheets modified: ${augmentResult.sheetsModified.join(", ")}.`,
    });

    logger.info("New draft foundation document created", {
      documentId: newFoundationDoc.id,
      title: newFoundationDoc.title,
    });

    // Return success response
    res.json({
      success: true,
      message: "Foundation document processed and saved as draft",
      foundationDocument: {
        id: newFoundationDoc.id,
        title: newFoundationDoc.title,
        status: newFoundationDoc.status,
        basedOn: {
          id: lastApprovedDoc.id,
          title: lastApprovedDoc.title,
        },
      },
      processing: {
        sheetsModified: augmentResult.sheetsModified,
        extractedDataCount: llmResponseData.extracted_data.length,
        confidence: llmResponseData.confidence,
        sourceDocumentId: actualSourceDocumentId,
        responseId: usedResponseId || responseId,
      },
    });
  } catch (error) {
    logger.error("Error processing foundation document:", error);
    res.status(500).json({
      error: "Failed to process foundation document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Download foundation document by ID
router.get("/download-foundation/:foundationDocumentId", async (req, res) => {
  try {
    const { foundationDocumentId } = req.params;

    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    logger.info("Downloading foundation document", { foundationDocumentId });

    // Get foundation document from Directus
    const foundationDoc = await directusDocumentService.getFoundationDocument(foundationDocumentId);

    if (!foundationDoc) {
      return res.status(404).json({
        error: "Foundation document not found",
        foundationDocumentId,
      });
    }

    if (!foundationDoc.file) {
      return res.status(404).json({
        error: "Foundation document has no file attached",
        foundationDocumentId,
      });
    }

    logger.info("Fetching foundation document file", {
      foundationDocumentId,
      fileId: foundationDoc.file,
    });

    // Download the file from Directus
    const fileBuffer = await directusDocumentService.downloadFile(foundationDoc.file);

    if (!fileBuffer) {
      return res.status(500).json({
        error: "Failed to download foundation document file",
        foundationDocumentId,
        fileId: foundationDoc.file,
      });
    }

    const filename = `${foundationDoc.title}.xlsx`;

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": fileBuffer.length.toString(),
    });

    logger.info("Foundation document downloaded successfully", {
      foundationDocumentId,
      fileSize: fileBuffer.length,
    });

    res.send(fileBuffer);
  } catch (error) {
    logger.error("Error downloading foundation document:", error);
    res.status(500).json({
      error: "Failed to download foundation document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update foundation document status (approve/reject)
router.post("/update-foundation-status", async (req, res) => {
  try {
    const { foundationDocumentId, status } = req.body;

    if (!foundationDocumentId) {
      return res.status(400).json({
        error: "Foundation document ID is required",
      });
    }

    if (!status || !["approved", "rejected", "draft"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be 'approved', 'rejected', or 'draft'",
      });
    }

    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    logger.info("Updating foundation document status", {
      foundationDocumentId,
      status,
    });

    // Update foundation document status in Directus
    const updatedDoc = await directusDocumentService.updateFoundationDocumentStatus(
      foundationDocumentId,
      status as "approved" | "rejected" | "draft"
    );

    logger.info("Foundation document status updated successfully", {
      foundationDocumentId,
      status,
      documentTitle: updatedDoc.title,
    });

    res.json({
      success: true,
      foundationDocument: {
        id: updatedDoc.id,
        title: updatedDoc.title,
        status: updatedDoc.status,
      },
      message: `Foundation document status updated to ${status}`,
    });
  } catch (error) {
    logger.error("Error updating foundation document status:", error);
    res.status(500).json({
      error: "Failed to update foundation document status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as documentRouter };
