import { createDirectus, rest, staticToken } from "@directus/sdk";
import { config } from "../../config";
import { logger } from "../../utils/logger";

/**
 * Directus Schema Definition
 * Define your collections and their types here
 *
 * Example:
 * type DirectusSchema = {
 *   users: User[];
 *   documents: Document[];
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DirectusSchema = Record<string, any>;

/**
 * Create and configure Directus client
 */
function createDirectusClient() {
  if (!config.directus.url) {
    logger.warn("Directus URL not configured. Directus client will not be available.");
    return null;
  }

  if (!config.directus.token) {
    logger.warn("Directus token not configured. Directus client will not be fully functional.");
  }

  try {
    // Create Directus client with REST API and authentication
    const client = createDirectus<DirectusSchema>(config.directus.url)
      .with(rest())
      .with(staticToken(config.directus.token));

    logger.info(`Directus client initialized successfully. URL: ${config.directus.url}`);

    return client;
  } catch (error) {
    logger.error("Failed to initialize Directus client:", error);
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
    throw new Error(
      "Directus client is not initialized. Check DIRECTUS_URL and DIRECTUS_TOKEN environment variables."
    );
  }
  return directusClient;
}
