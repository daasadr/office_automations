import { Router } from "express";
import { logger } from "../../../utils/logger";
import { generateExcelFile } from "../../../lib/excel";
import { directusDocumentService } from "../../../lib/directus";
import { filterRecentResponses, RESPONSE_MAX_AGE_HOURS } from "../shared";
import { requireDirectus, requireUrlParams, asyncHandler } from "../middleware/validation";

const router = Router();

// Download Excel file by document UUID (persists after restart)
router.get(
  "/:documentId/:filename",
  requireUrlParams(["documentId", "filename"]),
  requireDirectus,
  asyncHandler(async (req, res) => {
    const { documentId, filename } = req.params;

    logger.info("Downloading Excel by document ID", { documentId, filename });

    // Get latest response for this document (only recent ones within 8 hours)
    const allResponses = await directusDocumentService.getResponsesBySourceDocument(documentId);
    const responses = filterRecentResponses(allResponses || []);

    if (!responses || responses.length === 0) {
      return res.status(404).json({
        error: "No recent responses found for this document",
        message: `Responses must be within the last ${RESPONSE_MAX_AGE_HOURS} hours`,
      });
    }

    // Sort by created_at to get the latest response
    const latestResponse = responses.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];

    // Get generated documents for this response
    const generatedDocs = await directusDocumentService.getGeneratedDocumentsByResponse(
      latestResponse.id!
    );

    if (!generatedDocs || generatedDocs.length === 0) {
      // No generated document found, regenerate it
      logger.info("No generated document found, regenerating", { documentId });

      if (!latestResponse.response_json) {
        return res.status(404).json({
          error: "No response data found for this document",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validationResult = latestResponse.response_json as any;
      const excelResult = await generateExcelFile({
        jobId: documentId,
        validationResult,
      });

      if (!excelResult.success || !excelResult.buffer) {
        return res.status(500).json({
          error: "Failed to regenerate Excel file",
          details: excelResult.error,
        });
      }

      // Save the regenerated document to Directus
      try {
        await directusDocumentService.createGeneratedDocument({
          responseId: latestResponse.id!,
          file: {
            filename: excelResult.filename,
            buffer: excelResult.buffer,
            mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            title: `Generated Excel - ${excelResult.filename}`,
          },
          documentType: "excel",
          generationStatus: "completed",
          generationParams: {
            documentId,
            extractedDataCount: validationResult.extracted_data?.length || 0,
            confidence: validationResult.confidence || 0,
          },
        });
      } catch (saveError) {
        logger.warn("Failed to save regenerated document to Directus", {
          documentId,
          error: saveError,
        });
      }

      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${excelResult.filename}"`,
        "Content-Length": excelResult.buffer.length.toString(),
      });

      return res.send(excelResult.buffer);
    }

    // Download the most recent generated document
    const latestGenDoc = generatedDocs.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];

    if (!latestGenDoc.file) {
      return res.status(404).json({
        error: "Generated document has no file attached",
      });
    }

    const fileBuffer = await directusDocumentService.downloadFile(latestGenDoc.file);

    if (!fileBuffer) {
      return res.status(500).json({
        error: "Failed to download file from Directus",
      });
    }

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": fileBuffer.length.toString(),
    });

    res.send(fileBuffer);
  })
);

export { router as downloadByDocRouter };
