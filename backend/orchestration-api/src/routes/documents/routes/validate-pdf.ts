import { Router } from "express";
import { logger } from "../../../utils/logger";
import { createJob, updateJob, generateJobId } from "../../../services/jobService";
import { isDirectusAvailable } from "../../../lib/directus";
import { upload } from "../shared";
import { DocumentValidationService } from "../services/DocumentValidationService";

const router = Router();

/**
 * POST /validate-pdf
 *
 * Uploads and validates a PDF document using LLM (Gemini).
 * The document is saved to Directus and processed asynchronously.
 *
 * @route POST /documents/validate-pdf
 * @param {Express.Multer.File} file - The PDF file to validate (multipart/form-data)
 * @returns {Object} 200 - Success response with jobId and sourceDocumentId
 * @returns {Object} 400 - Invalid request (no file)
 * @returns {Object} 503 - Directus unavailable
 *
 * @example
 * // Response
 * {
 *   "success": true,
 *   "jobId": "job-abc123",
 *   "provider": "gemini",
 *   "directusSourceDocumentId": "doc-xyz789",
 *   "status": "processing",
 *   "message": "Document uploaded successfully. Processing started."
 * }
 */
router.post("/", upload.single("file"), async (req, res) => {
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

    // Check if Directus is available (required for this endpoint)
    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. Document upload requires Directus integration.",
      });
    }

    // Step 1: Save file to Directus using service
    const validationService = new DocumentValidationService();
    let sourceDocumentId: string;

    try {
      sourceDocumentId = await validationService.saveSourceDocument({
        filename: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        jobId,
      });
      updateJob(jobId, { directusSourceDocumentId: sourceDocumentId });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to save document",
        details: error instanceof Error ? error.message : "Unknown error",
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
        // Process the document using the service
        const result = await validationService.processDocument({
          jobId,
          filename: req.file!.originalname,
          buffer: req.file!.buffer,
          mimetype: req.file!.mimetype,
          size: req.file!.size,
        });

        if (result.error) {
          // Import failJob here to avoid circular dependency
          const { failJob } = await import("../../../services/jobService");
          failJob(jobId, result.error);
        } else if (result.validationResult) {
          // Complete the job - import completeJob here to avoid circular dependency
          const { completeJob } = await import("../../../services/jobService");
          completeJob(jobId, result.validationResult, "gemini");

          // Update job with response ID
          if (result.responseId) {
            updateJob(jobId, { directusResponseId: result.responseId });
          }
        }
      } catch (error) {
        logger.error("Unexpected error in async PDF processing", {
          jobId,
          sourceDocumentId,
          error,
        });
        // Import failJob here to avoid circular dependency
        const { failJob } = await import("../../../services/jobService");
        failJob(jobId, error instanceof Error ? error.message : "Unexpected error");
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

export { router as validatePdfRouter };
