import { Router } from "express";
import { jobService } from "@orchestration-api/services/JobService";
import { isDirectusAvailable } from "@orchestration-api/lib/directus";
import { ExcelGenerationService } from "@orchestration-api/services/ExcelGenerationService";
import { requireBodyParams, asyncHandler } from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * POST /generate-excel
 *
 * Generates an Excel file from validation data.
 * Supports fetching data from either:
 * - Directus (by documentId) - persists across restarts
 * - In-memory job (by jobId) - temporary until restart
 *
 * The generated Excel is automatically saved to Directus if available.
 *
 * @route POST /documents/generate-excel
 * @param {string} [documentId] - Source document ID (recommended - persists across restarts)
 * @param {string} [jobId] - Job ID (fallback - temporary)
 * @returns {Buffer} 200 - Excel file as binary stream
 * @returns {Object} 400 - Invalid request (missing ID)
 * @returns {Object} 404 - No validation data found
 * @returns {Object} 500 - Generation failed
 *
 * @example
 * // Request body
 * {
 *   "documentId": "doc-123"
 * }
 *
 * // Response headers
 * Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 * Content-Disposition: attachment; filename="extracted_data_2025-10-26.xlsx"
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
