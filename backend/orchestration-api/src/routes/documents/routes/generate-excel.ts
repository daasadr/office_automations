import { Router } from "express";
import { logger } from "../../../utils/logger";
import { generateExcelFile } from "../../../lib/excel";
import { getJob, setJobExcel, updateJob } from "../../../services/jobService";
import { directusDocumentService, isDirectusAvailable } from "../../../lib/directus";
import { filterRecentResponses } from "../shared";

const router = Router();

// Generate Excel file from job results
router.post("/", async (req, res) => {
  try {
    const { documentId, jobId } = req.body;

    if (!documentId && !jobId) {
      return res.status(400).json({ error: "Document ID or Job ID is required" });
    }

    let validationResult = null;
    let identifier = documentId || jobId;

    // Try to get data from document UUID first (persists after restart)
    if (documentId && isDirectusAvailable()) {
      try {
        logger.info("Fetching validation data from Directus by document ID", { documentId });

        const allResponses = await directusDocumentService.getResponsesBySourceDocument(documentId);
        const responses = filterRecentResponses(allResponses || []);

        if (responses && responses.length > 0) {
          // Get latest response
          const latestResponse = responses.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          })[0];

          if (latestResponse.response_json) {
            validationResult = latestResponse.response_json as any;
            logger.info("Retrieved validation data from Directus", {
              documentId,
              responseId: latestResponse.id,
            });
          }
        }
      } catch (directusError) {
        logger.warn("Failed to fetch data from Directus, will try job ID", {
          documentId,
          error: directusError,
        });
      }
    }

    // Fall back to job ID if document UUID didn't work
    if (!validationResult && jobId) {
      const job = getJob(jobId);
      if (job && job.validationResult) {
        validationResult = job.validationResult;
        identifier = jobId;
        logger.info("Retrieved validation data from job", { jobId });
      }
    }

    if (!validationResult) {
      return res.status(404).json({
        error: "No validation data found",
        details: documentId
          ? "No response found for this document ID"
          : "No job found for this job ID",
      });
    }

    // Generate Excel file
    const excelResult = await generateExcelFile({
      jobId: identifier,
      validationResult,
    });

    if (!excelResult.success) {
      return res.status(500).json({
        error: "Failed to generate Excel file",
        details: excelResult.error,
      });
    }

    // Store Excel data in job (only if jobId was provided)
    if (jobId) {
      setJobExcel(jobId, excelResult.buffer, excelResult.filename);
    }

    // Save generated document to Directus (if available and we have document ID)
    if (isDirectusAvailable() && documentId) {
      try {
        // Get latest response to associate with generated document (only recent ones)
        const allResponses = await directusDocumentService.getResponsesBySourceDocument(documentId);
        const responses = filterRecentResponses(allResponses || []);

        if (responses && responses.length > 0) {
          const latestResponse = responses.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          })[0];

          logger.info("Saving generated document to Directus", {
            documentId,
            responseId: latestResponse.id,
          });
          const generatedDocument = await directusDocumentService.createGeneratedDocument({
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
              extractedDataCount: (validationResult as any).extracted_data?.length || 0,
              confidence: (validationResult as any).confidence || 0,
            },
          });
          logger.info("Generated document saved to Directus", {
            documentId,
            generatedDocumentId: generatedDocument.id,
          });
        }
      } catch (directusError) {
        logger.warn("Failed to save generated document to Directus", {
          documentId,
          error: directusError,
        });
      }
    } else if (isDirectusAvailable() && jobId) {
      // Try to save using job ID's associated document
      const job = getJob(jobId);
      if (job?.directusResponseId) {
        try {
          logger.info("Saving generated document to Directus", {
            jobId,
            responseId: job.directusResponseId,
          });
          const generatedDocument = await directusDocumentService.createGeneratedDocument({
            responseId: job.directusResponseId,
            file: {
              filename: excelResult.filename,
              buffer: excelResult.buffer,
              mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              title: `Generated Excel - ${excelResult.filename}`,
            },
            documentType: "excel",
            generationStatus: "completed",
            generationParams: {
              jobId,
              extractedDataCount: (validationResult as any).extracted_data?.length || 0,
              confidence: (validationResult as any).confidence || 0,
            },
          });
          updateJob(jobId, { directusGeneratedDocumentId: generatedDocument.id });
          logger.info("Generated document saved to Directus", {
            jobId,
            generatedDocumentId: generatedDocument.id,
          });
        } catch (directusError) {
          logger.warn("Failed to save generated document to Directus", {
            jobId,
            error: directusError,
          });
        }
      }
    }

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${excelResult.filename}"`,
      "Content-Length": excelResult.buffer.length.toString(),
    });

    res.send(excelResult.buffer);
  } catch (error) {
    logger.error("Error generating Excel file:", error);
    res.status(500).json({
      error: "Failed to generate Excel file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as generateExcelRouter };
