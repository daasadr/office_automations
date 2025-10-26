import { Router } from "express";
import { FoundationProcessingService } from "../services/FoundationProcessingService";
import { requireDirectus, requireBodyParams, asyncHandler } from "../middleware/validation";

const router = Router();

/**
 * POST /process-foundation
 *
 * Processes a foundation document by augmenting it with extracted data from LLM response.
 * Takes the last approved foundation document XLS file, adds extracted data to it,
 * and saves it back as a new draft foundation document.
 *
 * @route POST /documents/process-foundation
 * @param {string} [jobId] - Job ID (one of jobId, responseId, or sourceDocumentId required)
 * @param {string} [responseId] - Response ID
 * @param {string} [sourceDocumentId] - Source document ID
 * @returns {Object} 200 - Success response with created foundation document details
 * @returns {Object} 400 - Invalid request (missing required parameters)
 * @returns {Object} 404 - Document or response not found
 * @returns {Object} 503 - Directus unavailable
 *
 * @example
 * // Request body
 * {
 *   "sourceDocumentId": "doc-123"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "message": "Foundation document processed and saved as draft",
 *   "foundationDocument": {
 *     "id": "foundation-456",
 *     "title": "Foundation Document (Augmented 2025-10-26)",
 *     "status": "draft",
 *     "basedOn": { "id": "foundation-123", "title": "Original Document" }
 *   },
 *   "processing": {
 *     "sheetsModified": ["Sheet1", "Sheet2"],
 *     "extractedDataCount": 10,
 *     "recordsAdded": 8,
 *     "duplicatesSkipped": []
 *   }
 * }
 */
router.post(
  "/",
  requireBodyParams(["jobId", "responseId", "sourceDocumentId"], { atLeastOne: true }),
  requireDirectus,
  asyncHandler(async (req, res) => {
    const { jobId, responseId, sourceDocumentId } = req.body;

    // Process foundation document using service
    const processingService = new FoundationProcessingService();
    const result = await processingService.processFoundationDocument({
      jobId,
      responseId,
      sourceDocumentId,
    });

    if (!result.success) {
      // Determine appropriate status code based on error message
      let statusCode = 500;
      if (result.error?.includes("not found") || result.error?.includes("No recent responses")) {
        statusCode = 404;
      } else if (
        result.error?.includes("required") ||
        result.error?.includes("No extracted data")
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        error: result.error || "Failed to process foundation document",
      });
    }

    // Return success response
    res.json({
      success: true,
      message: "Foundation document processed and saved as draft",
      foundationDocument: result.foundationDocument,
      processing: result.processing,
    });
  })
);

export { router as processFoundationRouter };
