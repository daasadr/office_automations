import { Router } from "express";
import multer from "multer";
import { logger } from "@orchestration-api/utils/logger";
import { jobService } from "@orchestration-api/services/JobService";
import { logisticsProcessingService } from "@orchestration-api/services/LogisticsProcessingService";
import { pdfPageExtractor } from "@orchestration-api/services/PdfPageExtractor";
import { directusDocumentService } from "@orchestration-api/lib/directus";
import {
  requireDirectus,
  requireFile,
  asyncHandler,
} from "@orchestration-api/middleware/validation";

const router = Router();

// Configure multer for logistics file uploads - 50MB limit for large PDFs
const uploadLogistics = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for logistics documents
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Please upload a PDF file."));
    }
  },
});

/**
 * @openapi
 * /logistics/upload:
 *   post:
 *     tags:
 *       - Logistics
 *     summary: Upload and process logistics document
 *     description: Upload a logistics PDF (invoice with transport documents) for processing. Large files (up to 50MB) are supported. Duplicate files are detected via hash.
 *     operationId: uploadLogistics
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to process (max 50MB)
 *             required:
 *               - file
 *     responses:
 *       200:
 *         description: Processing started or duplicate found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 logisticsDocumentId:
 *                   type: string
 *                 isDuplicate:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [processing, completed]
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - no file uploaded or invalid file type
 *       500:
 *         description: Internal server error
 */
router.post(
  "/upload",
  uploadLogistics.single("file"),
  requireFile,
  requireDirectus,
  asyncHandler(async (req, res) => {
    logger.info("[Logistics] Starting upload request");

    logger.info("[Logistics] File received", {
      originalName: req.file!.originalname,
      mimetype: req.file!.mimetype,
      size: req.file!.size,
    });

    // Generate job ID and create job
    const jobId = jobService.generateJobId();
    jobService.createJob(jobId, req.file!.originalname, req.file!.size);

    // Send response immediately with processing status
    res.json({
      success: true,
      jobId,
      status: "processing",
      message: "Document uploaded. Processing started.",
    });

    // Process asynchronously
    setImmediate(async () => {
      try {
        const result = await logisticsProcessingService.processDocument({
          filename: req.file!.originalname,
          buffer: req.file!.buffer,
          mimetype: req.file!.mimetype,
        });

        if (result.isDuplicate) {
          jobService.updateJob(jobId, {
            logisticsDocumentId: result.logisticsDocumentId,
            isDuplicate: true,
            duplicateOf: result.duplicateOf,
          });
          // Create a minimal ValidationResult from LogisticsDocument
          const logisticsDoc = result.result;
          if (logisticsDoc) {
            jobService.completeJob(
              jobId,
              {
                present_fields: logisticsDoc.present_fields || [],
                missing_fields: logisticsDoc.missing_fields || [],
                confidence: logisticsDoc.confidence || 0,
                extracted_data: [],
                provider: "gemini",
              },
              "gemini"
            );
          } else {
            jobService.updateJob(jobId, { status: "completed" });
          }
        } else {
          jobService.updateJob(jobId, {
            logisticsDocumentId: result.logisticsDocumentId,
            wasChunked: result.wasChunked,
            chunkCount: result.chunkCount,
          });
          // Create a minimal ValidationResult from LogisticsDocument
          const logisticsDoc = result.result;
          if (logisticsDoc) {
            jobService.completeJob(
              jobId,
              {
                present_fields: logisticsDoc.present_fields || [],
                missing_fields: logisticsDoc.missing_fields || [],
                confidence: logisticsDoc.confidence || 0,
                extracted_data: [],
                provider: "gemini",
              },
              "gemini"
            );
          } else {
            jobService.updateJob(jobId, { status: "completed" });
          }
        }

        logger.info("[Logistics] Processing completed", {
          jobId,
          logisticsDocumentId: result.logisticsDocumentId,
          isDuplicate: result.isDuplicate,
          wasChunked: result.wasChunked,
          processingTimeMs: result.processingTimeMs,
        });
      } catch (error) {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/535647d0-aa1b-460f-96f8-227c5ea24a78", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "logistics/index.ts:upload:catch",
            message: "Route handler catch block",
            data: {
              errorType: typeof error,
              errorConstructor: error?.constructor?.name,
              errorMessage: error instanceof Error ? error.message : "unknown",
              errorStack: error instanceof Error ? error.stack : "no stack",
              errorJson: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "C,E",
          }),
        }).catch(() => {});
        // #endregion
        logger.error("[Logistics] Processing failed", {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        });
        jobService.failJob(jobId, error instanceof Error ? error.message : "Processing failed");
      }
    });
  })
);

/**
 * @openapi
 * /logistics/status/{jobId}:
 *   get:
 *     tags:
 *       - Logistics
 *     summary: Get logistics processing status
 *     description: Get the status and results of a logistics document processing job
 *     operationId: getLogisticsStatus
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID returned from upload
 *     responses:
 *       200:
 *         description: Job status and results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [pending, processing, completed, failed]
 *                 logisticsDocumentId:
 *                   type: string
 *                 isDuplicate:
 *                   type: boolean
 *                 wasChunked:
 *                   type: boolean
 *                 result:
 *                   type: object
 *       404:
 *         description: Job not found
 */
router.get(
  "/status/:jobId",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    logger.debug("[Logistics] Status request", { jobId });

    const job = jobService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
        jobId,
      });
    }

    res.json({
      jobId,
      status: job.status,
      logisticsDocumentId: job.logisticsDocumentId,
      isDuplicate: job.isDuplicate,
      duplicateOf: job.duplicateOf,
      wasChunked: job.wasChunked,
      chunkCount: job.chunkCount,
      result: job.validationResult,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  })
);

/**
 * @openapi
 * /logistics/document/{documentId}:
 *   get:
 *     tags:
 *       - Logistics
 *     summary: Get logistics document by ID
 *     description: Get the full details of a processed logistics document
 *     operationId: getLogisticsDocument
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Logistics document ID
 *     responses:
 *       200:
 *         description: Logistics document details
 *       404:
 *         description: Document not found
 */
router.get(
  "/document/:documentId",
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    logger.debug("[Logistics] Document request", { documentId });

    const document = await logisticsProcessingService.getLogisticsDocument(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found",
        documentId,
      });
    }

    res.json(document);
  })
);

/**
 * @openapi
 * /logistics/document/{documentId}/page/{pageNumber}:
 *   get:
 *     tags:
 *       - Logistics
 *     summary: Extract and download a single page from a logistics document
 *     description: Downloads a specific page from the original logistics PDF as a single-page PDF
 *     operationId: getLogisticsDocumentPage
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Logistics document ID
 *       - in: path
 *         name: pageNumber
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number to extract (1-based)
 *     responses:
 *       200:
 *         description: Single-page PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Document not found, page not found, or file reference missing
 *       500:
 *         description: Internal server error
 */
router.get(
  "/document/:documentId/page/:pageNumber",
  requireDirectus,
  asyncHandler(async (req, res) => {
    const { documentId, pageNumber } = req.params;
    const pageNum = Number.parseInt(pageNumber, 10);

    logger.info("[Logistics] Page extraction request", {
      documentId,
      pageNumber: pageNum,
    });

    // Validate page number
    if (Number.isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        error: "Invalid page number",
        pageNumber,
      });
    }

    // Get the logistics document
    const document = await logisticsProcessingService.getLogisticsDocument(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found",
        documentId,
      });
    }

    // Check if document has a file reference
    if (!document.file) {
      logger.warn("[Logistics] Document has no file reference", { documentId });
      return res.status(404).json({
        error: "Document file not found",
        documentId,
      });
    }

    try {
      // Download the original PDF from Directus
      logger.debug("[Logistics] Downloading PDF from Directus", {
        fileId: document.file,
      });
      const pdfBuffer = await directusDocumentService.downloadFile(document.file);

      if (!pdfBuffer) {
        logger.warn("[Logistics] Could not download file from Directus", {
          fileId: document.file,
        });
        return res.status(404).json({
          error: "Could not download document file",
          documentId,
        });
      }

      // Extract the requested page
      const result = await pdfPageExtractor.extractPage({
        pdfBuffer,
        pageNumber: pageNum,
      });

      // Set appropriate headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="document-page-${pageNum}.pdf"`);
      res.setHeader("Content-Length", result.pdfBuffer.length);

      logger.info("[Logistics] Page extracted and sent", {
        documentId,
        pageNumber: pageNum,
        size: result.pdfBuffer.length,
      });

      // Send the PDF
      res.send(result.pdfBuffer);
    } catch (error) {
      logger.error("[Logistics] Error extracting page", {
        documentId,
        pageNumber: pageNum,
        error: error instanceof Error ? error.message : String(error),
      });

      // Check if it's a page number validation error
      if (error instanceof Error && error.message.includes("Invalid page number")) {
        return res.status(404).json({
          error: error.message,
          documentId,
          pageNumber: pageNum,
        });
      }

      return res.status(500).json({
        error: "Failed to extract page",
        documentId,
        pageNumber: pageNum,
      });
    }
  })
);

/**
 * @openapi
 * /logistics/reprocess/{documentId}:
 *   post:
 *     tags:
 *       - Logistics
 *     summary: Reprocess a logistics document
 *     description: Triggers LLM reprocessing of an existing logistics document, creating a new response while keeping the old one
 *     operationId: reprocessLogistics
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Logistics document ID to reprocess
 *     responses:
 *       200:
 *         description: Reprocessing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 logisticsDocumentId:
 *                   type: string
 *                 status:
 *                   type: string
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/reprocess/:documentId",
  requireDirectus,
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    logger.info("[Logistics] Starting reprocess request", { documentId });

    // Get the existing document
    const document = await logisticsProcessingService.getLogisticsDocument(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found",
        documentId,
      });
    }

    // Generate job ID and create job
    const jobId = jobService.generateJobId();
    jobService.createJob(jobId, document.title || "reprocess", 0);
    jobService.updateJob(jobId, { logisticsDocumentId: documentId });

    // Send response immediately with processing status
    res.json({
      success: true,
      jobId,
      logisticsDocumentId: documentId,
      status: "processing",
      message: "Reprocessing started.",
    });

    // Reprocess asynchronously
    setImmediate(async () => {
      try {
        const result = await logisticsProcessingService.reprocessDocument(documentId);

        jobService.updateJob(jobId, {
          wasChunked: result.wasChunked,
          chunkCount: result.chunkCount,
        });
        // Create a minimal ValidationResult from LogisticsDocument
        const logisticsDoc = result.result;
        if (logisticsDoc) {
          jobService.completeJob(
            jobId,
            {
              present_fields: logisticsDoc.present_fields || [],
              missing_fields: logisticsDoc.missing_fields || [],
              confidence: logisticsDoc.confidence || 0,
              extracted_data: [],
              provider: "gemini",
            },
            "gemini"
          );
        } else {
          jobService.updateJob(jobId, { status: "completed" });
        }

        logger.info("[Logistics] Reprocessing completed", {
          jobId,
          documentId,
          responseId: result.responseId,
          processingTimeMs: result.processingTimeMs,
        });
      } catch (error) {
        logger.error("[Logistics] Reprocessing failed", {
          jobId,
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
        jobService.failJob(jobId, error instanceof Error ? error.message : "Reprocessing failed");
      }
    });
  })
);

export { router as logisticsRouter };
