/**
 * Gemini API Rate Limit Configurations
 *
 * Rate limits based on Google's Gemini API documentation.
 * These are conservative defaults for the free tier.
 * Adjust based on your API tier (free/pay-as-you-go/provisioned).
 *
 * @see https://ai.google.dev/gemini-api/docs/rate-limits
 */

import type { GeminiModel, RateLimitConfig } from "../types";

/**
 * Default rate limits for Gemini models (free tier)
 * These are conservative estimates - adjust based on your actual tier
 */
export const GEMINI_RATE_LIMITS: Record<GeminiModel, RateLimitConfig> = {
  // Gemini 2.5 models
  "gemini-2.5-flash": {
    key: "gemini:gemini-2.5-flash",
    maxRequests: 10, // Free tier: 10 RPM
    window: "minute",
    maxTokensPerMinute: 250000,
  },
  "gemini-2.5-pro": {
    key: "gemini:gemini-2.5-pro",
    maxRequests: 5, // Free tier: 5 RPM
    window: "minute",
    maxTokensPerMinute: 250000,
  },

  // Gemini 2.0 models
  "gemini-2.0-flash": {
    key: "gemini:gemini-2.0-flash",
    maxRequests: 15, // Free tier: 15 RPM
    window: "minute",
    maxTokensPerMinute: 1000000,
  },
  "gemini-2.0-flash-lite": {
    key: "gemini:gemini-2.0-flash-lite",
    maxRequests: 30, // Free tier: 30 RPM
    window: "minute",
    maxTokensPerMinute: 1000000,
  },

  // Gemini 1.5 models
  "gemini-1.5-flash": {
    key: "gemini:gemini-1.5-flash",
    maxRequests: 15, // Free tier: 15 RPM
    window: "minute",
    maxTokensPerMinute: 1000000,
  },
  "gemini-1.5-flash-8b": {
    key: "gemini:gemini-1.5-flash-8b",
    maxRequests: 15, // Free tier: 15 RPM
    window: "minute",
    maxTokensPerMinute: 1000000,
  },
  "gemini-1.5-pro": {
    key: "gemini:gemini-1.5-pro",
    maxRequests: 2, // Free tier: 2 RPM
    window: "minute",
    maxTokensPerMinute: 32000,
  },
};

/**
 * Default rate limit for unknown Gemini models
 * Uses conservative limits to avoid hitting API limits
 */
export const DEFAULT_GEMINI_RATE_LIMIT: RateLimitConfig = {
  key: "gemini:default",
  maxRequests: 5,
  window: "minute",
  maxTokensPerMinute: 100000,
};

/**
 * Get rate limit configuration for a Gemini model
 */
export function getGeminiRateLimit(model: GeminiModel): RateLimitConfig {
  const config = GEMINI_RATE_LIMITS[model];
  if (config) {
    return config;
  }

  // Return default with model-specific key
  return {
    ...DEFAULT_GEMINI_RATE_LIMIT,
    key: `gemini:${model}`,
  };
}

/**
 * Override rate limits from environment variables
 * Format: GEMINI_RATE_LIMIT_<MODEL>=<maxRequests>
 * Example: GEMINI_RATE_LIMIT_GEMINI_2_5_FLASH=100
 */
export function getGeminiRateLimitWithOverrides(model: GeminiModel): RateLimitConfig {
  const baseConfig = getGeminiRateLimit(model);

  // Check for environment variable override
  const envKey = `GEMINI_RATE_LIMIT_${model.toUpperCase().replace(/[.-]/g, "_")}`;
  const envValue = process.env[envKey];

  if (envValue) {
    const maxRequests = parseInt(envValue, 10);
    if (!Number.isNaN(maxRequests) && maxRequests > 0) {
      return {
        ...baseConfig,
        maxRequests,
      };
    }
  }

  return baseConfig;
}
