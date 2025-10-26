import { Router } from "express";
import { logger } from "../../../utils/logger";
import { directusDocumentService, isDirectusAvailable } from "../../../lib/directus";

const router = Router();

// Update foundation document status (approve/reject)
router.post("/", async (req, res) => {
  try {
    const { foundationDocumentId, status } = req.body;

    if (!foundationDocumentId) {
      return res.status(400).json({
        error: "Foundation document ID is required",
      });
    }

    if (!status || !["approved", "rejected", "draft"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be 'approved', 'rejected', or 'draft'",
      });
    }

    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

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
  } catch (error) {
    logger.error("Error updating foundation document status:", error);
    res.status(500).json({
      error: "Failed to update foundation document status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as updateFoundationStatusRouter };
