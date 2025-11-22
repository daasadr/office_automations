import type { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { logger } from "@orchestration-api/utils/logger";

export function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction) {
  // Log error details
  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Capture exception in Sentry with additional context
  Sentry.captureException(error, {
    contexts: {
      request: {
        url: req.url,
        method: req.method,
        headers: {
          "user-agent": req.get("user-agent"),
          "content-type": req.get("content-type"),
        },
      },
    },
    tags: {
      endpoint: req.path,
      method: req.method,
    },
    user: {
      ip_address: req.ip,
    },
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    error: "Internal server error",
    message: isDevelopment ? error.message : "Something went wrong",
    ...(isDevelopment && { stack: error.stack }),
  });
}
