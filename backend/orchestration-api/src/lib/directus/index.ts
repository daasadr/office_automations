/**
 * Directus SDK Integration
 *
 * This module provides a configured Directus client for interacting with the Directus CMS.
 *
 * Usage:
 * ```typescript
 * import { directusClient, requireDirectus } from './lib/directus';
 *
 * // Use the client directly (check for null)
 * if (directusClient) {
 *   const items = await directusClient.request(readItems('collection_name'));
 * }
 *
 * // Or use requireDirectus() to throw an error if not configured
 * const client = requireDirectus();
 * const items = await client.request(readItems('collection_name'));
 * ```
 */

export { directusClient, isDirectusAvailable, requireDirectus } from "./client";

// Re-export commonly used Directus SDK functions for convenience
export {
  readItems,
  readItem,
  createItem,
  createItems,
  updateItem,
  updateItems,
  deleteItem,
  deleteItems,
  readUsers,
  readUser,
  readMe,
  readAssetRaw,
  uploadFiles,
} from "@directus/sdk";
