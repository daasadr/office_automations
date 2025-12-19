import pino from "pino";

// Logger configuration based on environment
const isDevelopment = import.meta.env.DEV || import.meta.env.NODE_ENV === "development";
const isProduction = import.meta.env.PROD || import.meta.env.NODE_ENV === "production";

// Create logger instance with environment-specific configuration
const logger = pino({
  name: "frontend-service",
  level: isDevelopment ? "debug" : "info",

  // Base fields to include in all logs
  base: {
    service: "frontend",
    version: import.meta.env.npm_package_version || "1.0.0",
    environment: import.meta.env.NODE_ENV || "development",
  },

  // Timestamp configuration
  timestamp: pino.stdTimeFunctions.isoTime,

  // Pretty printing for development
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
          messageFormat: "{service}[{reqId}]: {msg}",
          errorLikeObjectKeys: ["err", "error"],
        },
      }
    : undefined,

  // Serializers for common objects
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

  // Redact sensitive information in production
  redact: isProduction
    ? [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]',
        "password",
        "token",
        "secret",
      ]
    : [],
});

// Request ID generator for tracing
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Create child logger with request context
export function createRequestLogger(requestId: string, method?: string, url?: string) {
  return logger.child({
    reqId: requestId,
    ...(method && { method }),
    ...(url && { url }),
  });
}

// HTTP request logging utilities
export interface RequestLogData {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
  duration?: number;
  statusCode?: number;
  error?: Error;
  requestId: string;
}

export function logRequest(data: Partial<RequestLogData>, message?: string) {
  const requestLogger = createRequestLogger(
    data.requestId || generateRequestId(),
    data.method,
    data.url
  );

  if (data.error) {
    requestLogger.error(
      {
        ...data,
        err: data.error,
      },
      message || `${data.method} ${data.url} - Error`
    );
  } else if (data.statusCode && data.statusCode >= 400) {
    requestLogger.warn(data, message || `${data.method} ${data.url} - ${data.statusCode}`);
  } else {
    requestLogger.info(
      data,
      message || `${data.method} ${data.url} - ${data.statusCode || "Processing"}`
    );
  }
}

// Backend API request logging
export interface BackendRequestLogData {
  endpoint: string;
  method: string;
  requestId: string;
  duration?: number;
  statusCode?: number;
  error?: Error;
  requestSize?: number;
  responseSize?: number;
}

export function logBackendRequest(data: BackendRequestLogData, message?: string) {
  const requestLogger = createRequestLogger(data.requestId, data.method, data.endpoint);

  if (data.error) {
    requestLogger.error(
      {
        ...data,
        err: data.error,
        backend: true,
      },
      message || `Backend ${data.method} ${data.endpoint} - Error`
    );
  } else if (data.statusCode && data.statusCode >= 400) {
    requestLogger.warn(
      {
        ...data,
        backend: true,
      },
      message || `Backend ${data.method} ${data.endpoint} - ${data.statusCode}`
    );
  } else {
    requestLogger.info(
      {
        ...data,
        backend: true,
      },
      message || `Backend ${data.method} ${data.endpoint} - ${data.statusCode || "Success"}`
    );
  }
}

// File upload progress logging
export interface UploadProgressData {
  requestId: string;
  filename: string;
  fileSize: number;
  progress?: number;
  stage: "validation" | "upload" | "processing" | "complete" | "error";
  error?: Error;
  duration?: number;
}

export function logUploadProgress(data: UploadProgressData, message?: string) {
  const requestLogger = createRequestLogger(data.requestId);

  const logData = {
    ...data,
    upload: true,
    ...(data.error && { err: data.error }),
  };

  switch (data.stage) {
    case "error":
      requestLogger.error(logData, message || `Upload failed: ${data.filename}`);
      break;
    case "complete":
      requestLogger.info(logData, message || `Upload completed: ${data.filename}`);
      break;
    case "validation":
      requestLogger.debug(logData, message || `Validating upload: ${data.filename}`);
      break;
    case "upload":
      requestLogger.debug(
        logData,
        message || `Uploading: ${data.filename} (${data.progress || 0}%)`
      );
      break;
    case "processing":
      requestLogger.info(logData, message || `Processing: ${data.filename}`);
      break;
    default:
      requestLogger.info(logData, message || `Upload progress: ${data.filename}`);
  }
}

// Performance monitoring
export interface PerformanceData {
  requestId: string;
  operation: string;
  duration: number;
  metadata?: Record<string, any>;
}

export function logPerformance(data: PerformanceData, message?: string) {
  const requestLogger = createRequestLogger(data.requestId);

  requestLogger.info(
    {
      ...data,
      performance: true,
    },
    message || `Performance: ${data.operation} took ${data.duration}ms`
  );
}

// Security event logging
export interface SecurityEventData {
  requestId: string;
  event:
    | "invalid_file_type"
    | "file_too_large"
    | "invalid_request"
    | "rate_limit"
    | "suspicious_activity";
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export function logSecurityEvent(data: SecurityEventData, message?: string) {
  const requestLogger = createRequestLogger(data.requestId);

  requestLogger.warn(
    {
      ...data,
      security: true,
    },
    message || `Security event: ${data.event}`
  );
}

// Export the main logger instance
export default logger;

// Export typed logger methods for convenience
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
};
