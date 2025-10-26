import { Router } from "express";
import { logger } from "../../../utils/logger";
import { augmentExcelWithData } from "../../../lib/excel";
import { getJob } from "../../../services/jobService";
import { directusDocumentService, isDirectusAvailable } from "../../../lib/directus";
import type { LLMResponseSchema } from "../../../llmResponseSchema";
import { filterRecentResponses, RESPONSE_MAX_AGE_HOURS } from "../shared";

const router = Router();

/**
 * Process foundation document by augmenting it with extracted data from LLM response
 * Takes the last approved foundation document XLS file, adds extracted data to it,
 * and saves it back as a new draft foundation document
 */
router.post("/", async (req, res) => {
  try {
    logger.info("Starting foundation document processing");

    const { jobId, responseId, sourceDocumentId } = req.body;

    if (!jobId && !responseId && !sourceDocumentId) {
      return res.status(400).json({
        error: "Either jobId, responseId, or sourceDocumentId is required",
      });
    }

    // Check if Directus is available
    if (!isDirectusAvailable()) {
      return res.status(503).json({
        error: "Directus is not available. This endpoint requires Directus integration.",
      });
    }

    // Get LLM response data
    let llmResponseData: LLMResponseSchema | null = null;
    let actualSourceDocumentId: string | undefined;
    let usedResponseId: string | undefined;

    if (sourceDocumentId) {
      // Get latest response for this source document (only recent ones within 8 hours)
      logger.info("Fetching latest response for source document", { sourceDocumentId });
      const allResponses =
        await directusDocumentService.getResponsesBySourceDocument(sourceDocumentId);
      const responses = filterRecentResponses(allResponses || []);

      if (!responses || responses.length === 0) {
        return res.status(404).json({
          error: "No recent responses found for this source document",
          sourceDocumentId,
          message: `Responses must be within the last ${RESPONSE_MAX_AGE_HOURS} hours`,
        });
      }

      // Sort by created_at to get the latest response
      const latestResponse = responses.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })[0];

      if (!latestResponse.response_json) {
        return res.status(404).json({
          error: "Latest response has no response data",
          responseId: latestResponse.id,
        });
      }

      llmResponseData = latestResponse.response_json as unknown as LLMResponseSchema;
      actualSourceDocumentId = sourceDocumentId;
      usedResponseId = latestResponse.id;

      logger.info("Using latest response", {
        responseId: latestResponse.id,
        sourceDocumentId,
        responseDate: latestResponse.created_at,
      });
    } else if (jobId) {
      // Get from job
      const job = getJob(jobId);
      if (!job || !job.validationResult) {
        return res.status(404).json({
          error: "Job not found or has no validation result",
        });
      }

      llmResponseData = job.validationResult as unknown as LLMResponseSchema;
      actualSourceDocumentId = job.directusSourceDocumentId;
    } else if (responseId) {
      // Get from Directus response
      const response = await directusDocumentService.getResponse(responseId);
      if (!response || !response.response_json) {
        return res.status(404).json({
          error: "Response not found or has no response data",
        });
      }

      llmResponseData = response.response_json as unknown as LLMResponseSchema;
      actualSourceDocumentId = response.source_document;
      usedResponseId = responseId;
    }

    if (!llmResponseData || !llmResponseData.extracted_data) {
      return res.status(400).json({
        error: "No extracted data found in LLM response",
      });
    }

    logger.info("Retrieved LLM response data", {
      extractedDataCount: llmResponseData.extracted_data.length,
      confidence: llmResponseData.confidence,
    });

    // Get last approved foundation document
    const lastApprovedDoc = await directusDocumentService.getLastApprovedFoundationDocument();

    if (!lastApprovedDoc) {
      return res.status(404).json({
        error: "No approved foundation document found",
        message:
          "Please ensure there is at least one foundation document with 'approved' status in Directus",
      });
    }

    if (!lastApprovedDoc.file) {
      return res.status(400).json({
        error: "Approved foundation document has no file attached",
        documentId: lastApprovedDoc.id,
      });
    }

    logger.info("Retrieved last approved foundation document", {
      documentId: lastApprovedDoc.id,
      title: lastApprovedDoc.title,
      fileId: lastApprovedDoc.file,
    });

    // Download the Excel file
    const excelBuffer = await directusDocumentService.downloadFile(lastApprovedDoc.file);

    if (!excelBuffer) {
      return res.status(500).json({
        error: "Failed to download foundation document file",
        documentId: lastApprovedDoc.id,
        fileId: lastApprovedDoc.file,
      });
    }

    logger.info("Downloaded foundation document file", {
      size: excelBuffer.length,
    });

    // Augment the Excel file with extracted data
    const augmentResult = await augmentExcelWithData(excelBuffer, llmResponseData.extracted_data);

    if (!augmentResult.success || !augmentResult.buffer) {
      return res.status(500).json({
        error: "Failed to augment Excel file",
        details: augmentResult.error,
      });
    }

    logger.info("Excel file augmented successfully", {
      sheetsModified: augmentResult.sheetsModified,
      bufferSize: augmentResult.buffer.length,
      recordsAdded: augmentResult.recordsAdded,
      duplicatesSkipped: augmentResult.duplicatesSkipped.length,
    });

    // Generate filename for the augmented document
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const newFilename = `${lastApprovedDoc.title.replace(/\.[^/.]+$/, "")}_augmented_${timestamp}.xlsx`;

    // Build notes including duplicate information
    let notes = `Augmented from foundation document "${lastApprovedDoc.title}" with ${llmResponseData.extracted_data.length} extracted data items. Sheets modified: ${augmentResult.sheetsModified.join(", ")}.`;
    if (augmentResult.duplicatesSkipped.length > 0) {
      notes += ` Skipped ${augmentResult.duplicatesSkipped.length} duplicate records.`;
    }

    // Save as new draft foundation document
    const newFoundationDoc = await directusDocumentService.createFoundationDocument({
      title: `${lastApprovedDoc.title} (Augmented ${timestamp})`,
      file: {
        filename: newFilename,
        buffer: augmentResult.buffer,
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        title: newFilename,
      },
      sourceDocumentId: actualSourceDocumentId,
      docType: lastApprovedDoc.doc_type || "waste_management",
      status: "draft",
      contentJson: {
        basedOnDocument: lastApprovedDoc.id,
        augmentedWith: {
          jobId: jobId || undefined,
          responseId: usedResponseId || responseId || undefined,
          sourceDocumentId: actualSourceDocumentId,
          extractedDataCount: llmResponseData.extracted_data.length,
          recordsAdded: augmentResult.recordsAdded,
          duplicatesSkipped: augmentResult.duplicatesSkipped.length,
          sheetsModified: augmentResult.sheetsModified,
          confidence: llmResponseData.confidence,
        },
        augmentedAt: new Date().toISOString(),
      },
      notes,
    });

    logger.info("New draft foundation document created", {
      documentId: newFoundationDoc.id,
      title: newFoundationDoc.title,
    });

    // Build detailed records info for frontend display
    const extractedRecordsDetail = llmResponseData.extracted_data.map((extractedItem) => {
      const kodOdpadu = extractedItem["kód odpadu"] || (extractedItem as any).kod_odpadu;
      const odberatelIco =
        extractedItem.odběratel?.IČO ||
        (extractedItem as any).odberatel?.ico ||
        (extractedItem as any).odberatel?.IČO ||
        "";
      const sheetName = `${kodOdpadu} ${odberatelIco}`.trim();

      // Get table data from various possible field names
      const tabulka =
        extractedItem.tabulka ||
        (extractedItem as any).tabulka_evidence ||
        (extractedItem as any).tabulka_pohybu ||
        [];

      return {
        sheetName,
        kodOdpadu,
        nazevOdpadu:
          extractedItem["název/druh odpadu"] || (extractedItem as any).nazev_druhu_odpadu || "",
        odberatel: {
          ico: odberatelIco,
          nazev: extractedItem.odběratel?.název || (extractedItem as any).odberatel?.nazev || "",
        },
        records: tabulka.map((record: any) => ({
          poradoveCislo: record["pořadové číslo"] || record.poradove_cislo || 0,
          datumVzniku: record["datum vzniku"] || record.datum_vzniku || record.datum || "",
          mnozstviVznikleho:
            record["množství vzniklého odpadu"] || record.mnozstvi_vznikleho_odpadu || "",
          mnozstviPredaneho:
            record["množství předaného odpadu"] || record.mnozstvi_predaneho_odpadu || "",
        })),
      };
    });

    // Return success response
    res.json({
      success: true,
      message: "Foundation document processed and saved as draft",
      foundationDocument: {
        id: newFoundationDoc.id,
        title: newFoundationDoc.title,
        status: newFoundationDoc.status,
        basedOn: {
          id: lastApprovedDoc.id,
          title: lastApprovedDoc.title,
        },
      },
      processing: {
        sheetsModified: augmentResult.sheetsModified,
        extractedDataCount: llmResponseData.extracted_data.length,
        recordsAdded: augmentResult.recordsAdded,
        duplicatesSkipped: augmentResult.duplicatesSkipped,
        sheetsNotFound: augmentResult.sheetsNotFound,
        confidence: llmResponseData.confidence,
        sourceDocumentId: actualSourceDocumentId,
        responseId: usedResponseId || responseId,
        extractedRecordsDetail,
      },
    });
  } catch (error) {
    logger.error("Error processing foundation document:", error);
    res.status(500).json({
      error: "Failed to process foundation document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as processFoundationRouter };
