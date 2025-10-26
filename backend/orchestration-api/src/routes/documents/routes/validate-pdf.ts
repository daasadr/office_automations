import { Router } from "express";
import { logger } from "../../../utils/logger";
import { validateDocumentContent } from "../../../services/llm";
import { createJob, updateJob, generateJobId } from "../../../services/jobService";
import { directusDocumentService, isDirectusAvailable } from "../../../lib/directus";
import { upload } from "../shared";

const router = Router();

// Upload and validate PDF document
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

        // Complete the job - import completeJob here to avoid circular dependency
        const { completeJob } = await import("../../../services/jobService");
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
        // Import failJob here to avoid circular dependency
        const { failJob } = await import("../../../services/jobService");
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

export { router as validatePdfRouter };
