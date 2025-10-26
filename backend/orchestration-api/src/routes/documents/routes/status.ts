import { Router } from "express";
import { logger } from "../../../utils/logger";
import { getJob } from "../../../services/jobService";

const router = Router();

// Get job status by job ID (in-memory, doesn't persist after restart)
router.get("/:jobId", async (req, res) => {
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

export { router as statusRouter };
