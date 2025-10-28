import { Router } from "express";
import { jobService } from "@orchestration-api/services/JobService";
import { isDirectusAvailable } from "@orchestration-api/lib/directus";
import { ExcelGenerationService } from "@orchestration-api/services/ExcelGenerationService";
import { requireBodyParams, asyncHandler } from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * @openapi
 * /documents/generate-excel:
 *   post:
 *     tags:
 *       - Documents
 *     summary: Generate Excel file
 *     description: Generate an Excel file from validation results of a completed job
 *     operationId: generateExcel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: Job ID with completed validation results
 *             required:
 *               - jobId
 *     responses:
 *       200:
 *         description: Excel file generated successfully
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
 *       400:
 *         description: Bad request - missing job ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Job not found or no validation data available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error during Excel generation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  requireBodyParams(["documentId", "jobId"], { atLeastOne: true }),
  asyncHandler(async (req, res) => {
    const { documentId, jobId } = req.body;

    // Generate Excel using service
    const generationService = new ExcelGenerationService();
    const result = await generationService.generateExcel({
      documentId,
      jobId,
      saveToDirectus: isDirectusAvailable(),
    });

    if (!result.success || !result.buffer || !result.filename) {
      return res.status(result.error?.includes("not found") ? 404 : 500).json({
        error: result.error || "Failed to generate Excel file",
      });
    }

    // Store Excel data in job (only if jobId was provided)
    if (jobId) {
      jobService.setJobExcel(jobId, result.buffer, result.filename);
    }

    // Update job with generated document ID if available
    if (jobId && result.generatedDocumentId) {
      jobService.updateJob(jobId, { directusGeneratedDocumentId: result.generatedDocumentId });
    }

    // Send Excel file as response
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": result.buffer.length.toString(),
    });

    res.send(result.buffer);
  })
);

export { router as generateExcelRouter };
