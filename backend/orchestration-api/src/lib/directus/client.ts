import { createDirectus, rest, staticToken } from "@directus/sdk";
import { config } from "@orchestration-api/config";
import { logger } from "@orchestration-api/utils/logger";
import type { DirectusSchema } from "@orchestration-api/lib/directus/types";

/**
 * Create and configure Directus client
 */
function createDirectusClient() {
  // ATTEMPT LOG
  logger.info("[Directus] Attempting to initialize Directus client", {
    operation: "createDirectusClient",
    hasUrl: !!config.directus.url,
    hasToken: !!config.directus.token,
  });

  if (!config.directus.url) {
    logger.warn("[Directus] Directus URL not configured. Directus client will not be available.", {
      operation: "createDirectusClient",
    });
    return null;
  }

  if (!config.directus.token) {
    logger.warn(
      "[Directus] Directus token not configured. Directus client will not be fully functional.",
      {
        operation: "createDirectusClient",
        url: config.directus.url,
      }
    );
  }

  try {
    // Create Directus client with REST API and authentication
    const client = createDirectus<DirectusSchema>(config.directus.url)
      .with(rest())
      .with(staticToken(config.directus.token));

    // SUCCESS LOG
    logger.info("[Directus] Directus client initialized successfully", {
      operation: "createDirectusClient",
      url: config.directus.url,
    });

    return client;
  } catch (error) {
    // ERROR LOG
    logger.error("[Directus] Failed to initialize Directus client", {
      operation: "createDirectusClient",
      url: config.directus.url,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Singleton Directus client instance
 */
export const directusClient = createDirectusClient();

/**
 * Helper function to check if Directus is available
 */
export function isDirectusAvailable(): boolean {
  return directusClient !== null && Boolean(config.directus.token);
}

/**
 * Helper function to ensure Directus is available before making requests
 */
export function requireDirectus() {
  if (!directusClient) {
    // ERROR LOG
    logger.error("[Directus] Directus client is not initialized", {
      operation: "requireDirectus",
      hasUrl: !!config.directus.url,
      hasToken: !!config.directus.token,
    });
    throw new Error(
      "Directus client is not initialized. Check DIRECTUS_URL and DIRECTUS_TOKEN environment variables."
    );
  }

  logger.debug("[Directus] Directus client access granted", {
    operation: "requireDirectus",
  });

  return directusClient;
}
