/**
 * Rate Limiting Module
 *
 * Provides distributed rate limiting using Redis/KeyDB with sliding window algorithm.
 * Designed to be extensible for various services (Gemini, OpenAI, external APIs, etc.)
 *
 * @example
 * ```typescript
 * import { rateLimiter, getGeminiRateLimitWithOverrides, RateLimitError } from '@orchestration-api/lib/rateLimit';
 *
 * const model = 'gemini-2.5-flash';
 * const config = getGeminiRateLimitWithOverrides(model);
 * const result = await rateLimiter.checkAndConsume(config.key, config);
 *
 * if (!result.allowed) {
 *   throw new RateLimitError(result, 'gemini');
 * }
 * ```
 */

// Core rate limiter
export { RateLimiter, rateLimiter } from "./RateLimiter";

// Types
export type {
  IRateLimiter,
  RateLimitConfig,
  RateLimitResult,
  RateLimitWindow,
  ServiceRateLimits,
  GeminiModel,
} from "./types";

export { RateLimitError } from "./types";

// Gemini configuration
export {
  GEMINI_RATE_LIMITS,
  DEFAULT_GEMINI_RATE_LIMIT,
  getGeminiRateLimit,
  getGeminiRateLimitWithOverrides,
} from "./configs/gemini";
