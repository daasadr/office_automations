import { Request, Response, NextFunction } from "express";
import { logger } from "@orchestration-api/utils/logger";

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    error: "Internal server error",
    message: isDevelopment ? error.message : "Something went wrong",
    ...(isDevelopment && { stack: error.stack }),
  });
}
