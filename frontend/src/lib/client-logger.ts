// Client-side logging utility for React components and browser-side code
// This provides a consistent logging interface that works in the browser

import { CONTENT_TYPE_JSON } from "../constants";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ClientLogData {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

class ClientLogger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || false;
    this.logLevel = this.isDevelopment ? "debug" : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(data: ClientLogData): string {
    const parts = [
      `[${data.level.toUpperCase()}]`,
      data.timestamp,
      data.component ? `[${data.component}]` : "",
      data.requestId ? `[${data.requestId}]` : "",
      data.message,
    ].filter(Boolean);

    return parts.join(" ");
  }

  private log(
    level: LogLevel,
    message: string,
    options: Omit<ClientLogData, "level" | "message" | "timestamp"> = {}
  ) {
    if (!this.shouldLog(level)) return;

    const logData: ClientLogData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...options,
    };

    const formattedMessage = this.formatMessage(logData);

    // Console output with appropriate method
    switch (level) {
      case "debug":
        console.debug(formattedMessage, logData.metadata || "");
        break;
      case "info":
        console.info(formattedMessage, logData.metadata || "");
        break;
      case "warn":
        console.warn(formattedMessage, logData.metadata || "");
        break;
      case "error":
        console.error(formattedMessage, logData.error || logData.metadata || "");
        break;
    }

    // In development, also send to server for centralized logging
    if (this.isDevelopment && typeof window !== "undefined") {
      this.sendToServer(logData).catch((err) => {
        console.warn("Failed to send log to server:", err);
      });
    }
  }

  private async sendToServer(logData: ClientLogData): Promise<void> {
    try {
      await fetch("/api/client-logs", {
        method: "POST",
        headers: {
          "Content-Type": CONTENT_TYPE_JSON,
        },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      // Silently fail - we don't want logging to break the app
    }
  }

  debug(message: string, options?: Omit<ClientLogData, "level" | "message" | "timestamp">) {
    this.log("debug", message, options);
  }

  info(message: string, options?: Omit<ClientLogData, "level" | "message" | "timestamp">) {
    this.log("info", message, options);
  }

  warn(message: string, options?: Omit<ClientLogData, "level" | "message" | "timestamp">) {
    this.log("warn", message, options);
  }

  error(message: string, options?: Omit<ClientLogData, "level" | "message" | "timestamp">) {
    this.log("error", message, options);
  }

  // Specialized logging methods for common use cases

  componentMount(componentName: string, props?: Record<string, any>) {
    this.debug(`Component mounted: ${componentName}`, {
      component: componentName,
      action: "mount",
      metadata: props,
    });
  }

  componentUnmount(componentName: string) {
    this.debug(`Component unmounted: ${componentName}`, {
      component: componentName,
      action: "unmount",
    });
  }

  userAction(action: string, component?: string, metadata?: Record<string, any>) {
    this.info(`User action: ${action}`, {
      component,
      action: "user_interaction",
      metadata,
    });
  }

  apiRequest(url: string, method: string, requestId?: string) {
    this.debug(`API request: ${method} ${url}`, {
      action: "api_request",
      requestId,
      metadata: { url, method },
    });
  }

  apiResponse(url: string, method: string, status: number, duration: number, requestId?: string) {
    const level = status >= 400 ? "warn" : "debug";
    this.log(level, `API response: ${method} ${url} - ${status} (${duration}ms)`, {
      action: "api_response",
      requestId,
      metadata: { url, method, status, duration },
    });
  }

  apiError(url: string, method: string, error: Error, requestId?: string) {
    this.error(`API error: ${method} ${url}`, {
      action: "api_error",
      requestId,
      error,
      metadata: { url, method },
    });
  }

  uploadProgress(filename: string, progress: number, stage: string, requestId?: string) {
    this.info(`Upload progress: ${filename} - ${stage} (${progress}%)`, {
      action: "upload_progress",
      requestId,
      metadata: { filename, progress, stage },
    });
  }

  uploadError(filename: string, error: Error, requestId?: string) {
    this.error(`Upload error: ${filename}`, {
      action: "upload_error",
      requestId,
      error,
      metadata: { filename },
    });
  }

  uploadComplete(filename: string, duration: number, requestId?: string) {
    this.info(`Upload complete: ${filename} (${duration}ms)`, {
      action: "upload_complete",
      requestId,
      metadata: { filename, duration },
    });
  }

  formValidation(formName: string, errors: Record<string, string>) {
    this.warn(`Form validation errors: ${formName}`, {
      action: "form_validation",
      metadata: { formName, errors },
    });
  }

  performanceMetric(operation: string, duration: number, metadata?: Record<string, any>) {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      action: "performance",
      metadata: { operation, duration, ...metadata },
    });
  }
}

// Create singleton instance
const clientLogger = new ClientLogger();

// Export the instance and types
export default clientLogger;
export { clientLogger as logger };

// Export convenience functions
export const logComponentMount = clientLogger.componentMount.bind(clientLogger);
export const logComponentUnmount = clientLogger.componentUnmount.bind(clientLogger);
export const logUserAction = clientLogger.userAction.bind(clientLogger);
export const logApiRequest = clientLogger.apiRequest.bind(clientLogger);
export const logApiResponse = clientLogger.apiResponse.bind(clientLogger);
export const logApiError = clientLogger.apiError.bind(clientLogger);
export const logUploadProgress = clientLogger.uploadProgress.bind(clientLogger);
export const logUploadError = clientLogger.uploadError.bind(clientLogger);
export const logUploadComplete = clientLogger.uploadComplete.bind(clientLogger);
export const logFormValidation = clientLogger.formValidation.bind(clientLogger);
export const logPerformanceMetric = clientLogger.performanceMetric.bind(clientLogger);

// React hook for component logging
export function useLogger(componentName: string) {
  const log = {
    debug: (message: string, metadata?: Record<string, any>) =>
      clientLogger.debug(message, { component: componentName, metadata }),
    info: (message: string, metadata?: Record<string, any>) =>
      clientLogger.info(message, { component: componentName, metadata }),
    warn: (message: string, metadata?: Record<string, any>) =>
      clientLogger.warn(message, { component: componentName, metadata }),
    error: (message: string, error?: Error, metadata?: Record<string, any>) =>
      clientLogger.error(message, { component: componentName, error, metadata }),

    // Convenience methods with component context
    mount: (props?: Record<string, any>) => clientLogger.componentMount(componentName, props),
    unmount: () => clientLogger.componentUnmount(componentName),
    userAction: (action: string, metadata?: Record<string, any>) =>
      clientLogger.userAction(action, componentName, metadata),
    performance: (operation: string, duration: number, metadata?: Record<string, any>) =>
      clientLogger.performanceMetric(`${componentName}.${operation}`, duration, metadata),
  };

  return log;
}
