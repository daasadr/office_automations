import type { APIRoute } from "astro";
import { generateRequestId, logSecurityEvent, logUploadProgress } from "@/lib/logger";
import {
  createErrorResponse,
  createSuccessResponse,
  loggedFetch,
  RequestTimer,
  withLogging,
} from "@/lib/middleware";
import { CONTENT_TYPE_MULTIPART, HTTP_STATUS, ORCHESTRATION_API_URL } from "@/server-constants";

// Logistics documents can be up to 50MB (large PDFs with many pages)
const MAX_LOGISTICS_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = ["application/pdf"];

const uploadLogisticsHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();
  const timer = new RequestTimer();

  try {
    // Check content type
    if (!request.headers.get("content-type")?.includes(CONTENT_TYPE_MULTIPART)) {
      logSecurityEvent(
        {
          requestId,
          event: "invalid_request",
          details: { contentType: request.headers.get("content-type") },
        },
        "Invalid content type for upload"
      );

      return createErrorResponse("Invalid content type. Expected multipart/form-data.", {
        status: HTTP_STATUS.BAD_REQUEST,
        requestId,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      logSecurityEvent(
        {
          requestId,
          event: "invalid_request",
          details: { reason: "no_file_or_empty" },
        },
        "No file uploaded or file is empty"
      );

      return createErrorResponse("No file uploaded or file is empty.", {
        status: HTTP_STATUS.BAD_REQUEST,
        requestId,
      });
    }

    // Log upload start
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: "validation",
    });

    // Validate file type - only PDFs for logistics
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      logSecurityEvent(
        {
          requestId,
          event: "invalid_file_type",
          details: {
            filename: file.name,
            fileType: file.type,
            allowedTypes: ALLOWED_FILE_TYPES,
          },
        },
        `Invalid file type: ${file.type}`
      );

      return createErrorResponse("Invalid file type. Please upload a PDF file.", {
        status: HTTP_STATUS.BAD_REQUEST,
        requestId,
      });
    }

    // Validate file size - 50MB for logistics
    if (file.size > MAX_LOGISTICS_FILE_SIZE) {
      logSecurityEvent(
        {
          requestId,
          event: "file_too_large",
          details: {
            filename: file.name,
            fileSize: file.size,
            maxSize: MAX_LOGISTICS_FILE_SIZE,
          },
        },
        `File too large: ${file.size} bytes`
      );

      return createErrorResponse("Soubor je příliš velký. Maximální velikost je 50MB.", {
        status: HTTP_STATUS.BAD_REQUEST,
        requestId,
      });
    }

    // Log upload stage
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: "upload",
    });

    // Forward the request to the backend orchestration API
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const response = await loggedFetch(`${ORCHESTRATION_API_URL}/logistics/upload`, {
      method: "POST",
      body: backendFormData,
      requestId,
    });

    const result = await response.json();

    if (!response.ok) {
      logUploadProgress({
        requestId,
        filename: file.name,
        fileSize: file.size,
        stage: "error",
        duration: timer.getDuration(),
        error: new Error(result.error || "Backend processing failed"),
      });

      return createErrorResponse(result.error || "Backend processing failed", {
        status: response.status,
        requestId,
        details: result.details,
      });
    }

    // Log successful upload (processing happens async on backend)
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: "complete",
      duration: timer.getDuration(),
    });

    return createSuccessResponse(result, {
      requestId,
      message: "Logistics document uploaded and processing started",
    });
  } catch (error) {
    logUploadProgress({
      requestId,
      filename: "unknown",
      fileSize: 0,
      stage: "error",
      duration: timer.getDuration(),
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return createErrorResponse("Internal server error. Please try again later.", {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      requestId,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const POST = withLogging(uploadLogisticsHandler);
