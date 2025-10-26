import type { Request, Response, NextFunction } from "express";
import { logger } from "../../../utils/logger";
import { isDirectusAvailable } from "../../../lib/directus";
import { getJob } from "../../../services/jobService";
import type { RequestWithJob } from "../types";

// ============================================================================
// Type Narrowing Helpers
// ============================================================================

/**
 * Type guard to check if request has job attached
 * Used after requireJob middleware
 */
export function hasJobAttached(req: Request): req is RequestWithJob {
  return "job" in req && req.job !== undefined;
}

/**
 * Get job from request (guaranteed by middleware)
 * This replaces (req as RequestWithJob).job pattern
 */
export function getJobFromRequest(req: Request): RequestWithJob["job"] {
  if (!hasJobAttached(req)) {
    throw new Error("Job not attached to request. Use requireJob middleware first.");
  }
  return req.job;
}

/**
 * Middleware to check if Directus is available
 * Returns 503 if Directus is not available
 */
export const requireDirectus = (req: Request, res: Response, next: NextFunction) => {
  if (!isDirectusAvailable()) {
    logger.warn("Directus availability check failed", {
      endpoint: req.path,
      method: req.method,
    });
    return res.status(503).json({
      error: "Directus is not available. This endpoint requires Directus integration.",
    });
  }
  next();
};

/**
 * Middleware to validate that a file was uploaded
 * Returns 400 if no file is present in the request
 */
export const requireFile = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    logger.warn("File upload validation failed", {
      endpoint: req.path,
      method: req.method,
    });
    return res.status(400).json({
      error: "No file uploaded",
    });
  }
  next();
};

/**
 * Middleware to validate required body parameters
 * Usage: requireBodyParams(['jobId', 'responseId'])
 *
 * For "at least one of" validation, use atLeastOne option:
 * requireBodyParams(['jobId', 'responseId', 'documentId'], { atLeastOne: true })
 */
export const requireBodyParams = (params: string[], options?: { atLeastOne?: boolean }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options?.atLeastOne) {
      // At least one parameter must be present
      const hasAtLeastOne = params.some((param) => req.body[param]);
      if (!hasAtLeastOne) {
        logger.warn("Body parameter validation failed (at least one required)", {
          endpoint: req.path,
          method: req.method,
          requiredParams: params,
          providedParams: Object.keys(req.body),
        });
        return res.status(400).json({
          error: `At least one of the following parameters is required: ${params.join(", ")}`,
        });
      }
    } else {
      // All parameters must be present
      const missingParams = params.filter((param) => !req.body[param]);
      if (missingParams.length > 0) {
        logger.warn("Body parameter validation failed", {
          endpoint: req.path,
          method: req.method,
          missingParams,
          providedParams: Object.keys(req.body),
        });
        return res.status(400).json({
          error: `Missing required parameter(s): ${missingParams.join(", ")}`,
        });
      }
    }
    next();
  };
};

/**
 * Middleware to validate required URL parameters
 * Usage: requireUrlParams(['jobId', 'filename'])
 */
export const requireUrlParams = (params: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingParams = params.filter((param) => !req.params[param]);
    if (missingParams.length > 0) {
      logger.warn("URL parameter validation failed", {
        endpoint: req.path,
        method: req.method,
        missingParams,
        providedParams: Object.keys(req.params),
      });
      return res.status(400).json({
        error: `Missing required URL parameter(s): ${missingParams.join(", ")}`,
      });
    }
    next();
  };
};

/**
 * Middleware to validate that a job exists
 * Expects jobId in req.params or req.body
 * Attaches the job to req.job for downstream use
 */
export const requireJob = (source: "params" | "body" = "params") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const jobId = source === "params" ? req.params.jobId : req.body.jobId;

    if (!jobId) {
      logger.warn("Job validation failed: no jobId provided", {
        endpoint: req.path,
        method: req.method,
        source,
      });
      return res.status(400).json({
        error: "Job ID is required",
      });
    }

    const job = getJob(jobId);
    if (!job) {
      logger.warn("Job validation failed: job not found", {
        endpoint: req.path,
        method: req.method,
        jobId,
      });
      return res.status(404).json({
        error: "Job not found",
        jobId,
      });
    }

    // Attach job to request for downstream use
    // Note: This is the only place where we need to extend the Request type
    // All downstream code should use getJobFromRequest() helper
    Object.assign(req, { job });
    next();
  };
};

/**
 * Middleware to validate enum values
 * Usage: validateEnum('status', ['approved', 'rejected', 'draft'])
 */
export const validateEnum = (
  paramName: string,
  allowedValues: string[],
  source: "body" | "params" | "query" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req[source][paramName];

    if (!value) {
      logger.warn("Enum validation failed: parameter missing", {
        endpoint: req.path,
        method: req.method,
        paramName,
        source,
      });
      return res.status(400).json({
        error: `${paramName} is required`,
      });
    }

    if (!allowedValues.includes(value)) {
      logger.warn("Enum validation failed: invalid value", {
        endpoint: req.path,
        method: req.method,
        paramName,
        value,
        allowedValues,
      });
      return res.status(400).json({
        error: `Invalid ${paramName}. Must be one of: ${allowedValues.join(", ")}`,
      });
    }

    next();
  };
};

/**
 * Middleware to validate that job has Excel data
 * Expects job to be attached to req.job (use after requireJob middleware)
 */
export const requireJobExcel = (req: Request, res: Response, next: NextFunction) => {
  const job = getJobFromRequest(req);

  if (!job) {
    logger.error("requireJobExcel middleware used without requireJob", {
      endpoint: req.path,
      method: req.method,
    });
    return res.status(500).json({
      error: "Internal server error: job not attached",
    });
  }

  if (!job.excelBuffer || !job.excelFilename) {
    logger.warn("Job Excel validation failed", {
      endpoint: req.path,
      method: req.method,
      jobId: job.jobId,
      hasBuffer: !!job.excelBuffer,
      hasFilename: !!job.excelFilename,
    });
    return res.status(404).json({
      error: "Excel file not found for this job",
    });
  }

  next();
};

/**
 * Middleware to validate filename matches job's Excel filename
 * Expects job to be attached to req.job (use after requireJob middleware)
 * Expects filename in req.params
 */
export const validateFilename = (req: Request, res: Response, next: NextFunction) => {
  const job = getJobFromRequest(req);
  const { filename } = req.params;

  if (!job) {
    logger.error("validateFilename middleware used without requireJob", {
      endpoint: req.path,
      method: req.method,
    });
    return res.status(500).json({
      error: "Internal server error: job not attached",
    });
  }

  if (!filename) {
    logger.warn("Filename validation failed: no filename provided", {
      endpoint: req.path,
      method: req.method,
    });
    return res.status(400).json({
      error: "Filename is required",
    });
  }

  if (job.excelFilename !== filename) {
    logger.warn("Filename validation failed: mismatch", {
      endpoint: req.path,
      method: req.method,
      jobId: job.jobId,
      expectedFilename: job.excelFilename,
      providedFilename: filename,
    });
    return res.status(404).json({
      error: "File not found",
    });
  }

  next();
};

/**
 * Global error handler middleware for document routes
 * Catches any uncaught errors and returns a consistent error response
 */
export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error in document route", {
    endpoint: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
  });

  // Check if response already sent
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error",
    details: error.message,
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
