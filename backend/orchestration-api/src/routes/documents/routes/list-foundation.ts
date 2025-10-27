import { Router } from "express";
import { logger } from "@orchestration-api/utils/logger";
import { directusDocumentService } from "@orchestration-api/lib/directus";
import { requireDirectus, asyncHandler } from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * GET /list-foundation
 *
 * Retrieves all foundation documents from Directus, sorted by creation date (newest first).
 * Returns information about each document including ID, title, status, creation date, and metadata.
 *
 * @route GET /documents/list-foundation
 * @returns {Object} 200 - Success response with array of foundation documents
 * @returns {Object} 503 - Directus unavailable
 *
 * @example
 * // Response
 * {
 *   "success": true,
 *   "documents": [
 *     {
 *       "id": "foundation-123",
 *       "title": "Foundation Document (Augmented 2025-10-26)",
 *       "status": "approved",
 *       "doc_type": "waste_management",
 *       "created_at": "2025-10-26T10:30:00.000Z",
 *       "updated_at": "2025-10-26T11:00:00.000Z",
 *       "content_json": { ... },
 *       "notes": "Latest approved document"
 *     },
 *     ...
 *   ],
 *   "count": 5,
 *   "lastApprovedId": "foundation-123"
 * }
 */
router.get(
  "/",
  requireDirectus,
  asyncHandler(async (_req, res) => {
    logger.info("Retrieving all foundation documents");

    // Get all foundation documents
    const documents = await directusDocumentService.getAllFoundationDocuments();

    // Find the last approved document
    const lastApproved = documents.find((doc) => doc.status === "approved");

    logger.info("Foundation documents retrieved", {
      count: documents.length,
      lastApprovedId: lastApproved?.id,
    });

    res.json({
      success: true,
      documents,
      count: documents.length,
      lastApprovedId: lastApproved?.id || null,
    });
  })
);

export { router as listFoundationRouter };
