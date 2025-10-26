import multer from "multer";
import { logger } from "../../utils/logger";
import type { Response } from "../../lib/directus/types";

// Helper function to filter responses by age (8 hours)
export const RESPONSE_MAX_AGE_HOURS = 8;
export const RESPONSE_MAX_AGE_MS = RESPONSE_MAX_AGE_HOURS * 60 * 60 * 1000;

// Minimal type for filtering responses by created_at
type FilterableResponse = Pick<Response, "id" | "created_at"> & Partial<Response>;

export function filterRecentResponses<T extends FilterableResponse>(responses: T[]): T[] {
  const now = Date.now();
  const cutoffTime = now - RESPONSE_MAX_AGE_MS;

  return responses.filter((response) => {
    if (!response.created_at) return false;
    const responseTime = new Date(response.created_at).getTime();
    const isRecent = responseTime > cutoffTime;

    if (!isRecent) {
      logger.debug("Filtering out old response", {
        responseId: response.id,
        createdAt: response.created_at,
        ageHours: Math.round((now - responseTime) / (60 * 60 * 1000)),
        maxAgeHours: RESPONSE_MAX_AGE_HOURS,
      });
    }

    return isRecent;
  });
}

// Configure multer for file uploads
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Please upload a PDF, CSV, or Excel file."));
    }
  },
});
