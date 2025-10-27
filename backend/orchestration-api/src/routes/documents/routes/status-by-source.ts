import { Router } from "express";
import { logger } from "../../../utils/logger";
import { directusDocumentService } from "../../../lib/directus";
import { filterRecentResponses } from "../shared";
import { requireDirectus, requireUrlParams, asyncHandler } from "../../../middleware/validation";
import { parseResponseJson } from "../../../utils/dataTransformers";

const router = Router();

// Get document status by source document UUID (persists after restart)
router.get(
  "/:sourceDocumentId",
  requireUrlParams(["sourceDocumentId"]),
  requireDirectus,
  asyncHandler(async (req, res) => {
    const { sourceDocumentId } = req.params;

    logger.info("Fetching document status by source document ID", { sourceDocumentId });

    // Get source document
    const sourceDocument = await directusDocumentService.getSourceDocument(sourceDocumentId);
    if (!sourceDocument) {
      return res.status(404).json({
        error: "Source document not found",
        sourceDocumentId,
      });
    }

    // Get latest response for this source document (only recent ones within 8 hours)
    const allResponses =
      await directusDocumentService.getResponsesBySourceDocument(sourceDocumentId);
    const responses = filterRecentResponses(allResponses || []);

    let validationResult = null;
    if (responses && responses.length > 0) {
      // Sort by created_at to get the latest response
      const latestResponse = responses.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })[0];

      logger.info("Using recent response", {
        sourceDocumentId,
        responseId: latestResponse.id,
        responseAge: Math.round(
          (Date.now() - new Date(latestResponse.created_at || 0).getTime()) / (60 * 1000)
        ),
        ageUnit: "minutes",
      });

      if (latestResponse.response_json) {
        const responseData = parseResponseJson(latestResponse.response_json);
        // Only include validationResult if it has the required fields
        if (responseData) {
          validationResult = responseData;
          logger.info("Valid response data found", {
            sourceDocumentId,
            responseId: latestResponse.id,
            hasExtractedData: !!responseData.extracted_data,
          });
        } else {
          logger.warn("Response data incomplete, treating as not ready", {
            sourceDocumentId,
            responseId: latestResponse.id,
            hasValidStructure: false,
          });
        }
      }
    }

    // Return document status
    const response = {
      sourceDocumentId: sourceDocument.id,
      status: sourceDocument.processing_status || "completed",
      fileName: sourceDocument.title,
      fileSize: sourceDocument.bytes,
      createdAt: sourceDocument.created_at,
      updatedAt: sourceDocument.updated_at,
      directusSourceDocumentId: sourceDocument.id,
      validationResult: validationResult
        ? {
            present: validationResult.present,
            missing: validationResult.missing,
            confidence: validationResult.confidence,
            extracted_data: validationResult.extracted_data,
            provider: validationResult.provider,
          }
        : null,
    };

    logger.info("Returning document status", {
      sourceDocumentId,
      hasValidationResult: !!validationResult,
      status: response.status,
    });

    res.json(response);
  })
);

export { router as statusBySourceRouter };
