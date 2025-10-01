// API Configuration
export const ORCHESTRATION_API_URL =
  import.meta.env.ORCHESTRATION_API_URL || "http://localhost:3001";

// HTTP Headers
export const CONTENT_TYPE_JSON = "application/json";
export const CONTENT_TYPE_PDF = "application/pdf";
export const CONTENT_TYPE_MULTIPART = "multipart/form-data";

// File Configuration
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ["application/pdf"] as const;

// Common HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
