import { Router } from "express";
import { logger } from "../../../utils/logger";
import { directusDocumentService, isDirectusAvailable } from "../../../lib/directus";

const router = Router();

// Download foundation document by ID
router.get("/:foundationDocumentId", async (req, res) => {
  try {
    const { foundationDocumentId } = req.params;

    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    logger.info("Downloading foundation document", { foundationDocumentId });

    // Get foundation document from Directus
    const foundationDoc = await directusDocumentService.getFoundationDocument(foundationDocumentId);

    if (!foundationDoc) {
      return res.status(404).json({
        error: "Foundation document not found",
        foundationDocumentId,
      });
    }

    if (!foundationDoc.file) {
      return res.status(404).json({
        error: "Foundation document has no file attached",
        foundationDocumentId,
      });
    }

    logger.info("Fetching foundation document file", {
      foundationDocumentId,
      fileId: foundationDoc.file,
    });

    // Download the file from Directus
    const fileBuffer = await directusDocumentService.downloadFile(foundationDoc.file);

    if (!fileBuffer) {
      return res.status(500).json({
        error: "Failed to download foundation document file",
        foundationDocumentId,
        fileId: foundationDoc.file,
      });
    }

    const filename = `${foundationDoc.title}.xlsx`;

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": fileBuffer.length.toString(),
    });

    logger.info("Foundation document downloaded successfully", {
      foundationDocumentId,
      fileSize: fileBuffer.length,
    });

    res.send(fileBuffer);
  } catch (error) {
    logger.error("Error downloading foundation document:", error);
    res.status(500).json({
      error: "Failed to download foundation document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as downloadFoundationRouter };
