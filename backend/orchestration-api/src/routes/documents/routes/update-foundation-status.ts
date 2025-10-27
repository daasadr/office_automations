import { Router } from "express";
import { logger } from "@orchestration-api/utils/logger";
import { directusDocumentService } from "@orchestration-api/lib/directus";
import {
  requireDirectus,
  requireBodyParams,
  validateEnum,
  asyncHandler,
} from "@orchestration-api/middleware/validation";

const router = Router();

// Update foundation document status (approve/reject)
router.post(
  "/",
  requireBodyParams(["foundationDocumentId", "status"]),
  validateEnum("status", ["approved", "rejected", "draft"]),
  requireDirectus,
  asyncHandler(async (req, res) => {
    const { foundationDocumentId, status } = req.body;

    logger.info("Updating foundation document status", {
      foundationDocumentId,
      status,
    });

    // Update foundation document status in Directus
    const updatedDoc = await directusDocumentService.updateFoundationDocumentStatus(
      foundationDocumentId,
      status as "approved" | "rejected" | "draft"
    );

    logger.info("Foundation document status updated successfully", {
      foundationDocumentId,
      status,
      documentTitle: updatedDoc.title,
    });

    res.json({
      success: true,
      foundationDocument: {
        id: updatedDoc.id,
        title: updatedDoc.title,
        status: updatedDoc.status,
      },
      message: `Foundation document status updated to ${status}`,
    });
  })
);

export { router as updateFoundationStatusRouter };
