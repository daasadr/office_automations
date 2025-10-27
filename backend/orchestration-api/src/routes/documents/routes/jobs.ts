import { Router } from "express";
import { jobService } from "@orchestration-api/services/JobService";
import { asyncHandler } from "@orchestration-api/middleware/validation";

const router = Router();

// List all jobs (for debugging/admin purposes)
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const jobs = jobService.getAllJobs().map((job) => ({
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
  })
);

export { router as jobsRouter };
