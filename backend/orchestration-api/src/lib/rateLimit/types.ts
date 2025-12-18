/**
 * Rate Limiting Types
 * Extensible rate limiting types for various services
 */

/**
 * Supported rate limit window types
 */
export type RateLimitWindow = "second" | "minute" | "hour" | "day";

/**
 * Rate limit configuration for a specific resource/model
 */
export interface RateLimitConfig {
  /** Unique identifier for the rate limit (e.g., "gemini:gemini-2.5-flash") */
  key: string;
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window for the rate limit */
  window: RateLimitWindow;
  /** Optional: Maximum tokens per minute (for LLM APIs) */
  maxTokensPerMinute?: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Total limit for the window */
  limit: number;
  /** Time in ms until the rate limit resets */
  resetInMs: number;
  /** Time in ms to wait before retrying (0 if allowed) */
  retryAfterMs: number;
  /** Current request count in the window */
  currentCount: number;
}

/**
 * Rate limit error thrown when rate limit is exceeded
 */
export class RateLimitError extends Error {
  public readonly retryAfterMs: number;
  public readonly remaining: number;
  public readonly resetInMs: number;
  public readonly serviceName: string;

  constructor(result: RateLimitResult, serviceName: string) {
    super(`Rate limit exceeded for ${serviceName}. Retry after ${result.retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = result.retryAfterMs;
    this.remaining = result.remaining;
    this.resetInMs = result.resetInMs;
    this.serviceName = serviceName;
  }
}

/**
 * Service-specific rate limit preset configurations
 */
export interface ServiceRateLimits {
  [serviceKey: string]: RateLimitConfig;
}

/**
 * Gemini model names
 */
export type GeminiModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-lite"
  | "gemini-1.5-flash"
  | "gemini-1.5-flash-8b"
  | "gemini-1.5-pro"
  | string; // Allow custom models

/**
 * Rate limiter interface for extensibility
 */
export interface IRateLimiter {
  /** Check and consume a rate limit slot */
  checkAndConsume(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
  /** Just check without consuming */
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
  /** Reset rate limit for a key */
  reset(key: string): Promise<void>;
  /** Get current status without consuming */
  getStatus(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
}
