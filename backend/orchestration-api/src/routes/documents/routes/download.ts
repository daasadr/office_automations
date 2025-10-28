import { Router } from "express";
import {
  requireJob,
  requireJobExcel,
  validateFilename,
  asyncHandler,
  getJobFromRequest,
} from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * @openapi
 * /documents/download/{jobId}/{filename}:
 *   get:
 *     tags:
 *       - Documents
 *     summary: Download Excel file
 *     description: Download a previously generated Excel file for a job
 *     operationId: downloadExcel
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         description: Job identifier
 *         schema:
 *           type: string
 *       - name: filename
 *         in: path
 *         required: true
 *         description: Excel filename
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel file downloaded successfully
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: Attachment with filename
 *             schema:
 *               type: string
 *       404:
 *         description: Excel file not found
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
  "/:jobId/:filename",
  requireJob("params"),
  requireJobExcel,
  validateFilename,
  asyncHandler(async (req, res) => {
    const job = getJobFromRequest(req);

    // Note: excelBuffer and excelFilename are guaranteed to exist by requireJobExcel middleware
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${job.excelFilename}"`,
      "Content-Length": job.excelBuffer!.length.toString(),
    });

    res.send(job.excelBuffer!);
  })
);

export { router as downloadRouter };
