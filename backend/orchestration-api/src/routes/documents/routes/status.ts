import { Router } from "express";
import {
  requireJob,
  asyncHandler,
  getJobFromRequest,
} from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * @openapi
 * /documents/status/{jobId}:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Get job status
 *     description: Retrieve the status and results of a document validation job
 *     operationId: getJobStatus
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         description: Unique job identifier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatusResponse'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:jobId",
  requireJob("params"),
  asyncHandler(async (req, res) => {
    const job = getJobFromRequest(req);

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
            present_fields: job.validationResult.present_fields,
            missing_fields: job.validationResult.missing_fields,
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
