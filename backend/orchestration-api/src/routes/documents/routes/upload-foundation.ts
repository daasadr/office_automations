import { Router } from "express";
import { logger } from "@orchestration-api/utils/logger";
import { directusDocumentService } from "@orchestration-api/lib/directus";
import { upload } from "../shared";
import {
  requireDirectus,
  requireFile,
  asyncHandler,
} from "@orchestration-api/middleware/validation";

const router = Router();

/**
 * POST /upload-foundation
 *
 * Uploads a new foundation document (Excel file) to Directus.
 * The document is created with "approved" status by default.
 *
 * @route POST /documents/upload-foundation
 * @param {Express.Multer.File} file - The Excel file to upload (multipart/form-data)
 * @param {string} [title] - Optional title for the document (defaults to filename)
 * @param {string} [notes] - Optional notes for the document
 * @returns {Object} 200 - Success response with created foundation document details
 * @returns {Object} 400 - Invalid request (no file or invalid type)
 * @returns {Object} 503 - Directus unavailable
 *
 * @example
 * // Response
 * {
 *   "success": true,
 *   "message": "Foundation document uploaded successfully",
 *   "foundationDocument": {
 *     "id": "foundation-123",
 *     "title": "New Foundation Document",
 *     "status": "approved",
 *     "doc_type": "waste_management",
 *     "created_at": "2025-10-27T10:30:00.000Z",
 *     "file": "file-456"
 *   }
 * }
 */
router.post(
  "/",
  upload.single("file"),
  requireFile,
  requireDirectus,
  asyncHandler(async (req, res) => {
    const file = req.file!;
    const { title, notes } = req.body;

    logger.info("Uploading foundation document", {
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Validate file type (must be Excel)
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: "Invalid file type. Please upload an Excel file (.xls or .xlsx).",
      });
    }

    // Create foundation document
    const foundationDoc = await directusDocumentService.createFoundationDocument({
      title: title || file.originalname.replace(/\.[^/.]+$/, ""), // Remove extension from filename
      file: {
        filename: file.originalname,
        buffer: file.buffer,
        mimetype: file.mimetype,
        title: title || file.originalname,
      },
      docType: "waste_management",
      status: "approved", // New uploads are approved by default
      notes: notes || undefined,
    });

    logger.info("Foundation document uploaded successfully", {
      foundationDocumentId: foundationDoc.id,
      title: foundationDoc.title,
    });

    res.json({
      success: true,
      message: "Foundation document uploaded successfully",
      foundationDocument: {
        id: foundationDoc.id,
        title: foundationDoc.title,
        status: foundationDoc.status,
        doc_type: foundationDoc.doc_type,
        created_at: foundationDoc.created_at,
        file: foundationDoc.file,
      },
    });
  })
);

export { router as uploadFoundationRouter };
