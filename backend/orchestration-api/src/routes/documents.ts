import { Router } from "express";
import multer from "multer";
import { logger } from "../utils/logger";
import { validateDocumentContent } from "../services/llmService";
import { generateExcelFile } from "../services/excelService";
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

const router = Router();

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

    // Step 1: Save file to Directus (if available)
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
        logger.warn("Failed to save source document to Directus, continuing without it", {
          jobId,
          error: directusError,
        });
      }
    }

    // Step 2: Use Gemini for native PDF processing (no image conversion needed)
    try {
      logger.info(`Processing PDF with Gemini (provider: ${provider})`, { jobId });
      const startTime = Date.now();
      const validationResult = await validateDocumentContent(
        new Uint8Array(req.file.buffer).buffer,
        { provider: "gemini" }
      );
      const processingTimeMs = Date.now() - startTime;

      // Complete the job
      completeJob(jobId, validationResult, "gemini");

      // Step 3: Save LLM response to Directus (if available and source document was created)
      if (isDirectusAvailable() && sourceDocumentId) {
        try {
          logger.info("Saving LLM response to Directus", { jobId, sourceDocumentId });
          const response = await directusDocumentService.createResponse({
            sourceDocumentId,
            prompt: "PDF document validation and data extraction", // Could be more detailed
            responseJson: {
              present: validationResult.present,
              missing: validationResult.missing,
              confidence: validationResult.confidence,
              extracted_data: validationResult.extracted_data,
            },
            modelName: "gemini-2.5-flash",
            tokenCount: undefined, // Gemini API doesn't return token count in the same way
            processingTimeMs,
            status: "completed",
          });
          updateJob(jobId, { directusResponseId: response.id });

          // Update source document status
          await directusDocumentService.updateSourceDocumentStatus(sourceDocumentId, "completed");

          logger.info("LLM response saved to Directus", {
            jobId,
            responseId: response.id,
          });
        } catch (directusError) {
          logger.warn("Failed to save LLM response to Directus", {
            jobId,
            error: directusError,
          });
        }
      }

      logger.info("PDF validation completed successfully with Gemini", { jobId });

      return res.json({
        success: true,
        jobId: jobId,
        provider: "gemini",
        directusSourceDocumentId: sourceDocumentId,
      });
    } catch (geminiError) {
      logger.error("Gemini PDF validation failed", { jobId, error: geminiError });
      failJob(jobId, geminiError instanceof Error ? geminiError.message : "PDF validation failed");

      // Update Directus status if document was created
      if (isDirectusAvailable() && sourceDocumentId) {
        try {
          await directusDocumentService.updateSourceDocumentStatus(sourceDocumentId, "failed");
        } catch (directusError) {
          logger.warn("Failed to update source document status in Directus", {
            jobId,
            error: directusError,
          });
        }
      }

      return res.status(500).json({
        error: "PDF validation failed",
        details:
          geminiError instanceof Error
            ? geminiError.message
            : "Unknown error occurred during PDF processing",
      });
    }
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

// Get job status
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
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    const job = getJob(jobId);
    if (!job || !job.validationResult) {
      return res.status(404).json({ error: "No data found for this job ID" });
    }

    // Generate Excel file
    const excelResult = await generateExcelFile({
      jobId,
      validationResult: job.validationResult,
    });

    if (!excelResult.success) {
      return res.status(500).json({
        error: "Failed to generate Excel file",
        details: excelResult.error,
      });
    }

    // Store Excel data in job
    setJobExcel(jobId, excelResult.buffer, excelResult.filename);

    // Save generated document to Directus (if available and response was created)
    if (isDirectusAvailable() && job.directusResponseId) {
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
            extractedDataCount: job.validationResult.extracted_data.length,
            confidence: job.validationResult.confidence,
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

export { router as documentRouter };
