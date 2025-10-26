import type { APIRoute } from "astro";
import {
  withLogging,
  createErrorResponse,
  createSuccessResponse,
  loggedFetch,
} from "../../../lib/middleware";
import { generateRequestId, logPerformance } from "../../../lib/logger";
import { ORCHESTRATION_API_URL, CONTENT_TYPE_JSON } from "../../../server-constants";

const statusBySourceHandler: APIRoute = async ({ params }) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  try {
    const documentId = params.documentId;

    if (!documentId) {
      return createErrorResponse("Document ID is required.", { status: 400, requestId });
    }

    // Log the status check request
    logPerformance({
      requestId,
      operation: "status_by_source_check_start",
      duration: 0,
      metadata: { documentId },
    });

    // Forward the request to the backend orchestration API
    const backendResponse = await loggedFetch(
      `${ORCHESTRATION_API_URL}/documents/status-by-source/${documentId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": CONTENT_TYPE_JSON,
        },
        requestId,
      }
    );

    const result = await backendResponse.json();

    if (!backendResponse.ok) {
      return createErrorResponse(result.error || "Backend request failed", {
        status: backendResponse.status,
        requestId,
        details: result.details,
      });
    }

    // Log successful status retrieval
    logPerformance({
      requestId,
      operation: "status_by_source_check_complete",
      duration: Date.now() - startTime,
      metadata: {
        documentId,
        status: result.status || "unknown",
      },
    });

    const response = createSuccessResponse(result, {
      requestId,
    });

    // Add cache control header
    response.headers.set("Cache-Control", "no-cache");

    return response;
  } catch (error) {
    return createErrorResponse("Internal server error. Please try again later.", {
      status: 500,
      requestId,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const GET = withLogging(statusBySourceHandler);

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
