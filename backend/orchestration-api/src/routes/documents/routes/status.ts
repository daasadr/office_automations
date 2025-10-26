import { Router } from "express";
import { requireJob, asyncHandler, type RequestWithJob } from "../middleware/validation";

const router = Router();

// Get job status by job ID (in-memory, doesn't persist after restart)
router.get(
  "/:jobId",
  requireJob("params"),
  asyncHandler(async (req, res) => {
    const job = (req as RequestWithJob).job;

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
  })
);

export { router as statusRouter };
