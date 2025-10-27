import multer from "multer";

// Re-export response filtering utilities from dataTransformers
export {
  filterRecentResponses,
  RESPONSE_MAX_AGE_HOURS,
  RESPONSE_MAX_AGE_MS,
} from "../../utils/dataTransformers";

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
