import { Router } from "express";
import { jobService } from "@orchestration-api/services/JobService";
import { asyncHandler } from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * @openapi
 * /documents/jobs:
 *   get:
 *     tags:
 *       - Documents
 *     summary: List all jobs
 *     description: Get a list of all jobs for debugging and administrative purposes
 *     operationId: getAllJobs
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobListResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
