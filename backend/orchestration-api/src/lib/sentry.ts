import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initializeSentry() {
  if (!config.sentry.dsn) {
    logger.warn("Sentry DSN not configured, skipping Sentry initialization");
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    enabled: config.sentry.enabled,
    // Performance Monitoring
    tracesSampleRate: config.sentry.tracesSampleRate,
    // Profiling
    profilesSampleRate: config.sentry.profilesSampleRate,
    integrations: [
      // Add profiling integration
      nodeProfilingIntegration(),
      // Express integration for automatic instrumentation
      Sentry.expressIntegration(),
    ],
    // Send default PII (Personal Identifiable Information)
    sendDefaultPii: config.sentry.sendDefaultPii,
    // Breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out sensitive data from breadcrumbs if needed
      if (breadcrumb.category === "http" && breadcrumb.data) {
        // Remove sensitive headers
        if (breadcrumb.data.headers) {
          delete breadcrumb.data.headers.authorization;
          delete breadcrumb.data.headers.cookie;
        }
      }
      return breadcrumb;
    },
    // Before sending events
    beforeSend(event) {
      // Filter or modify events before sending
      // Remove sensitive data from request body if present
      if (event.request?.data) {
        // Example: redact password fields
        if (typeof event.request.data === "object") {
          const data = event.request.data as Record<string, unknown>;
          if (data.password) {
            data.password = "[REDACTED]";
          }
        }
      }
      return event;
    },
  });

  logger.info("Sentry initialized successfully", {
    environment: config.nodeEnv,
    dsn: config.sentry.dsn.substring(0, 20) + "...",
  });
}

/**
 * Get Sentry instance
 */
export { Sentry };
