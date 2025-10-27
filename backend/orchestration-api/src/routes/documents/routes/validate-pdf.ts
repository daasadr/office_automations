import { Router } from "express";
import { logger } from "@orchestration-api/utils/logger";
import { jobService } from "@orchestration-api/services/JobService";
import { upload } from "../shared";
import { DocumentValidationService } from "@orchestration-api/services/DocumentValidationService";
import {
  requireDirectus,
  requireFile,
  asyncHandler,
} from "@orchestration-api/middleware/validation";

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
router.post(
  "/",
  upload.single("file"),
  requireFile,
  requireDirectus,
  asyncHandler(async (req, res) => {
    logger.info("Starting PDF validation request");

    // Use Gemini for PDF processing
    const provider = "gemini";

    logger.info("File received for validation", {
      originalName: req.file!.originalname,
      mimetype: req.file!.mimetype,
      size: req.file!.size,
      provider: provider,
    });

    // Generate job ID and create job
    const jobId = jobService.generateJobId();
    jobService.createJob(jobId, req.file!.originalname, req.file!.size);

    // Step 1: Save file to Directus using service
    const validationService = new DocumentValidationService();
    let sourceDocumentId: string;

    try {
      sourceDocumentId = await validationService.saveSourceDocument({
        filename: req.file!.originalname,
        buffer: req.file!.buffer,
        mimetype: req.file!.mimetype,
        jobId,
      });
      jobService.updateJob(jobId, { directusSourceDocumentId: sourceDocumentId });
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
          jobService.failJob(jobId, result.error);
        } else if (result.validationResult) {
          jobService.completeJob(jobId, result.validationResult, "gemini");

          // Update job with response ID
          if (result.responseId) {
            jobService.updateJob(jobId, { directusResponseId: result.responseId });
          }
        }
      } catch (error) {
        logger.error("Unexpected error in async PDF processing", {
          jobId,
          sourceDocumentId,
          error,
        });
        jobService.failJob(jobId, error instanceof Error ? error.message : "Unexpected error");
      }
    });
  })
);

export { router as validatePdfRouter };
