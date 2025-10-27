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
 * Sanitizes filename by removing or replacing special characters
 * Handles Czech diacritics and other potentially problematic characters
 */
function sanitizeFilename(filename: string): string {
  // Map of diacritics to their ASCII equivalents
  const diacriticsMap: Record<string, string> = {
    á: "a",
    č: "c",
    ď: "d",
    é: "e",
    ě: "e",
    í: "i",
    ň: "n",
    ó: "o",
    ř: "r",
    š: "s",
    ť: "t",
    ú: "u",
    ů: "u",
    ý: "y",
    ž: "z",
    Á: "A",
    Č: "C",
    Ď: "D",
    É: "E",
    Ě: "E",
    Í: "I",
    Ň: "N",
    Ó: "O",
    Ř: "R",
    Š: "S",
    Ť: "T",
    Ú: "U",
    Ů: "U",
    Ý: "Y",
    Ž: "Z",
  };

  // Split filename into name and extension
  const lastDotIndex = filename.lastIndexOf(".");
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : "";

  // Replace diacritics
  let sanitized = name
    .split("")
    .map((char) => diacriticsMap[char] || char)
    .join("");

  // Remove or replace other special characters
  // Keep: letters, numbers, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Remove multiple consecutive underscores
  sanitized = sanitized.replace(/_+/g, "_");

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, "");

  // If name is empty after sanitization, use a default
  if (!sanitized) {
    sanitized = "document";
  }

  return sanitized + extension;
}

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

    // Sanitize filename to avoid issues with special characters
    const sanitizedFilename = sanitizeFilename(file.originalname);
    const sanitizedTitle = sanitizeFilename(title || file.originalname.replace(/\.[^/.]+$/, ""));

    logger.info("Uploading foundation document", {
      originalName: file.originalname,
      sanitizedFilename,
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

    // Create foundation document with sanitized names
    const foundationDoc = await directusDocumentService.createFoundationDocument({
      title: sanitizedTitle,
      file: {
        filename: sanitizedFilename,
        buffer: file.buffer,
        mimetype: file.mimetype,
        title: sanitizedTitle,
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
