/**
 * Document Route Middleware
 *
 * Centralized middleware for document routes to reduce code duplication
 * and ensure consistent validation across all endpoints.
 */

export {
  requireDirectus,
  requireFile,
  requireBodyParams,
  requireUrlParams,
  requireJob,
  validateEnum,
  requireJobExcel,
  validateFilename,
  errorHandler,
  asyncHandler,
  type RequestWithJob,
} from "./validation";
