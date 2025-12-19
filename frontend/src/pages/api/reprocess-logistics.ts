import type { APIRoute } from "astro";
import { generateRequestId } from "@/lib/logger";
import {
  createErrorResponse,
  createSuccessResponse,
  loggedFetch,
  RequestTimer,
  withLogging,
} from "@/lib/middleware";
import { HTTP_STATUS, ORCHESTRATION_API_URL } from "@/server-constants";

const reprocessLogisticsHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();
  const _timer = new RequestTimer();

  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return createErrorResponse("documentId is required", {
        status: HTTP_STATUS.BAD_REQUEST,
        requestId,
      });
    }

    const response = await loggedFetch(
      `${ORCHESTRATION_API_URL}/logistics/reprocess/${documentId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        requestId,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return createErrorResponse(result.error || "Reprocessing failed", {
        status: response.status,
        requestId,
        details: result.details,
      });
    }

    return createSuccessResponse(result, {
      requestId,
      message: "Reprocessing started",
    });
  } catch (error) {
    return createErrorResponse("Internal server error", {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      requestId,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const POST = withLogging(reprocessLogisticsHandler);
