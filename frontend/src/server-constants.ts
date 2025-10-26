// Server-only constants - includes environment variables and server configuration
// This file should only be imported by server-side code (API routes, SSR pages, etc.)

// Re-export client-safe constants
export * from "./client-constants";

// Server-only configuration
export const ORCHESTRATION_API_URL = process.env.ORCHESTRATION_API_URL ||
  import.meta.env.ORCHESTRATION_API_URL;

if (!ORCHESTRATION_API_URL) {
  throw new Error("ORCHESTRATION_API_URL is not defined");
}