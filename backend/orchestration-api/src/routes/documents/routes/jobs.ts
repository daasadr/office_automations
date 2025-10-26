import { Router } from "express";
import { logger } from "../../../utils/logger";
import { getAllJobs } from "../../../services/jobService";

const router = Router();

// List all jobs (for debugging/admin purposes)
router.get("/", async (_req, res) => {
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

export { router as jobsRouter };
