import type { APIRoute } from "astro";
import { withLogging, createSuccessResponse, createErrorResponse } from "@/lib/middleware";
import { generateRequestId, createRequestLogger } from "@/lib/logger";
import type { ClientLogData } from "@/lib/client-logger";

const clientLogsHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();

  try {
    // Only accept POST requests
    if (request.method !== "POST") {
      return createErrorResponse("Method not allowed. Use POST.", { status: 405, requestId });
    }

    // Parse the client log data
    const clientLogData: ClientLogData = await request.json();

    // Validate required fields
    if (!clientLogData.level || !clientLogData.message || !clientLogData.timestamp) {
      return createErrorResponse(
        "Invalid log data. Missing required fields: level, message, timestamp.",
        { status: 400, requestId }
      );
    }

    // Create a logger with client context
    const logger = createRequestLogger(clientLogData.requestId || requestId, "CLIENT", request.url);

    // Log the client message with appropriate level
    const logMessage = `[CLIENT] ${clientLogData.message}`;
    const logContext = {
      client: true,
      component: clientLogData.component,
      action: clientLogData.action,
      userAgent: request.headers.get("user-agent"),
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
      ...clientLogData.metadata,
    };

    switch (clientLogData.level) {
      case "debug":
        logger.debug(logContext, logMessage);
        break;
      case "info":
        logger.info(logContext, logMessage);
        break;
      case "warn":
        logger.warn(logContext, logMessage);
        break;
      case "error":
        logger.error(
          {
            ...logContext,
            err: clientLogData.error,
          },
          logMessage
        );
        break;
      default:
        logger.info(logContext, logMessage);
    }

    return createSuccessResponse(
      { received: true },
      {
        status: 200,
        requestId,
        message: "Client log received successfully",
      }
    );
  } catch (error) {
    return createErrorResponse("Failed to process client log", {
      status: 500,
      requestId,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const POST = withLogging(clientLogsHandler);

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
