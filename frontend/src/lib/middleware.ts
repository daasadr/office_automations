import type { APIRoute } from "astro";
import { generateRequestId, logRequest } from "@/lib/logger";
import { CONTENT_TYPE_JSON } from "@/client-constants";

// Request timing utility
export class RequestTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

// Extract client information from request
export function extractClientInfo(request: Request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || undefined;
  const contentLength = request.headers.get("content-length")
    ? parseInt(request.headers.get("content-length")!, 10)
    : undefined;

  // Try to get real IP from various headers (for reverse proxy setups)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    undefined;

  return {
    method: request.method,
    url: url.pathname + url.search,
    userAgent,
    ip,
    contentLength,
  };
}

// Logging middleware wrapper for API routes
export function withLogging<T extends APIRoute>(handler: T): T {
  return (async (context) => {
    const requestId = generateRequestId();
    const timer = new RequestTimer();
    const clientInfo = extractClientInfo(context.request);

    // Log incoming request
    logRequest(
      {
        ...clientInfo,
        requestId,
      },
      `Incoming ${clientInfo.method} ${clientInfo.url}`
    );

    try {
      // Execute the handler
      const response = await handler(context);
      const duration = timer.getDuration();

      // Log successful response
      logRequest(
        {
          ...clientInfo,
          requestId,
          duration,
          statusCode: response.status,
        },
        `${clientInfo.method} ${clientInfo.url} completed`
      );

      // Add request ID to response headers for tracing
      response.headers.set("X-Request-ID", requestId);

      return response;
    } catch (error) {
      const duration = timer.getDuration();

      // Log error
      logRequest(
        {
          ...clientInfo,
          requestId,
          duration,
          error: error instanceof Error ? error : new Error(String(error)),
        },
        `${clientInfo.method} ${clientInfo.url} failed`
      );

      // Re-throw the error to be handled by the caller
      throw error;
    }
  }) as T;
}

// Create a response with consistent headers and logging
export function createLoggedResponse(
  body: any,
  options: {
    status?: number;
    headers?: Record<string, string>;
    requestId?: string;
  } = {}
): Response {
  const { status = 200, headers = {}, requestId } = options;

  const responseHeaders = {
    "Content-Type": CONTENT_TYPE_JSON,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    ...headers,
    ...(requestId && { "X-Request-ID": requestId }),
  };

  return new Response(typeof body === "string" ? body : JSON.stringify(body, null, 2), {
    status,
    headers: responseHeaders,
  });
}

// Error response helper with logging
export function createErrorResponse(
  error: string | Error,
  options: {
    status?: number;
    requestId?: string;
    details?: any;
  } = {}
): Response {
  const { status = 500, requestId, details } = options;

  const errorMessage = error instanceof Error ? error.message : error;

  const errorBody = {
    success: false,
    error: errorMessage,
    ...(details && { details }),
    ...(requestId && { requestId }),
    timestamp: new Date().toISOString(),
  };

  return createLoggedResponse(errorBody, {
    status,
    requestId,
  });
}

// Success response helper with logging
export function createSuccessResponse(
  data: any,
  options: {
    status?: number;
    requestId?: string;
    message?: string;
  } = {}
): Response {
  const { status = 200, requestId, message } = options;

  const responseBody = {
    success: true,
    ...(message && { message }),
    ...(data && (typeof data === "object" ? data : { data })),
    ...(requestId && { requestId }),
    timestamp: new Date().toISOString(),
  };

  return createLoggedResponse(responseBody, {
    status,
    requestId,
  });
}

// Backend request wrapper with logging
export async function loggedFetch(
  url: string,
  options: RequestInit & { requestId?: string } = {}
): Promise<Response> {
  const { requestId = generateRequestId(), ...fetchOptions } = options;
  const method = fetchOptions.method || "GET";
  const timer = new RequestTimer();

  // Import logging functions dynamically to avoid circular imports
  const { logBackendRequest } = await import("./logger");

  try {
    // Log outgoing request
    logBackendRequest(
      {
        endpoint: url,
        method,
        requestId,
        requestSize: fetchOptions.body
          ? typeof fetchOptions.body === "string"
            ? fetchOptions.body.length
            : undefined
          : undefined,
      },
      `Outgoing ${method} ${url}`
    );

    const response = await fetch(url, fetchOptions);
    const duration = timer.getDuration();

    // Log response
    logBackendRequest(
      {
        endpoint: url,
        method,
        requestId,
        duration,
        statusCode: response.status,
        responseSize: parseInt(response.headers.get("content-length") || "0", 10) || undefined,
      },
      `${method} ${url} responded`
    );

    return response;
  } catch (error) {
    const duration = timer.getDuration();

    // Log error
    logBackendRequest(
      {
        endpoint: url,
        method,
        requestId,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
      },
      `${method} ${url} failed`
    );

    throw error;
  }
}
