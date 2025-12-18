/**
 * Rate-Limited Gemini Client
 *
 * Wraps the Google Generative AI client with rate limiting support.
 * Handles automatic retries with exponential backoff when rate limited.
 */

import { GoogleGenerativeAI, type GenerativeModel, type Part } from "@google/generative-ai";
import { logger } from "@orchestration-api/utils/logger";
import {
  rateLimiter,
  getGeminiRateLimitWithOverrides,
  RateLimitError,
  type GeminiModel,
  type RateLimitResult,
} from "@orchestration-api/lib/rateLimit";

export interface RateLimitedGeminiOptions {
  /** Maximum number of retry attempts when rate limited */
  maxRetries?: number;
  /** Whether to throw on rate limit or return null */
  throwOnRateLimit?: boolean;
  /** Custom rate limit per minute (overrides model default, 0 or undefined = use model default) */
  customRateLimit?: number;
}

interface GenerateContentResult {
  response: {
    text(): string;
  };
}

/** Input part for generateContent - text or inline data */
export type ContentPart = Part;

/**
 * Rate-limited wrapper for Gemini API
 *
 * Features:
 * - Automatic rate limiting based on model configuration
 * - Exponential backoff with jitter for retries
 * - Support for multiple Gemini models
 * - Environment variable overrides for rate limits
 */
export class RateLimitedGeminiClient {
  private genAI: GoogleGenerativeAI | null;
  private readonly modelName: GeminiModel;
  private readonly options: Required<RateLimitedGeminiOptions>;

  constructor(
    apiKey: string | undefined,
    modelName: GeminiModel,
    options?: RateLimitedGeminiOptions
  ) {
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.modelName = modelName;
    this.options = {
      maxRetries: options?.maxRetries ?? 3,
      throwOnRateLimit: options?.throwOnRateLimit ?? true,
      customRateLimit: options?.customRateLimit ?? 0,
    };
  }

  /**
   * Check if the client is configured
   */
  get isConfigured(): boolean {
    return this.genAI !== null;
  }

  /**
   * Get the model name
   */
  get model(): GeminiModel {
    return this.modelName;
  }

  /**
   * Get the rate limit configuration for this model
   */
  getRateLimitConfig() {
    const config = getGeminiRateLimitWithOverrides(this.modelName);
    if (this.options.customRateLimit > 0) {
      return {
        ...config,
        maxRequests: this.options.customRateLimit,
      };
    }
    return config;
  }

  /**
   * Check current rate limit status without consuming
   */
  async getRateLimitStatus(): Promise<RateLimitResult> {
    const config = this.getRateLimitConfig();
    return rateLimiter.getStatus(config.key, config);
  }

  /**
   * Wait with exponential backoff and jitter
   */
  private async waitWithBackoff(attempt: number, baseWaitMs: number): Promise<void> {
    // Exponential backoff: baseWait * 2^attempt + random jitter
    const exponentialWait = baseWaitMs * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1s jitter
    const waitTime = Math.min(exponentialWait + jitter, 120000); // Cap at 2 minutes

    logger.info(`[RateLimitedGemini] Waiting ${Math.round(waitTime)}ms before retry`, {
      attempt: attempt + 1,
      model: this.modelName,
    });

    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  /**
   * Acquire a rate limit slot, with retries
   */
  private async acquireRateLimitSlot(): Promise<RateLimitResult> {
    const config = this.getRateLimitConfig();

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      const result = await rateLimiter.checkAndConsume(config.key, config);

      if (result.allowed) {
        logger.debug("[RateLimitedGemini] Rate limit slot acquired", {
          model: this.modelName,
          remaining: result.remaining,
          limit: result.limit,
        });
        return result;
      }

      // Rate limited - check if we should retry
      if (attempt < this.options.maxRetries) {
        await this.waitWithBackoff(attempt, result.retryAfterMs);
      } else {
        // No more retries
        if (this.options.throwOnRateLimit) {
          throw new RateLimitError(result, `gemini:${this.modelName}`);
        }
        return result;
      }
    }

    // Should not reach here, but satisfy TypeScript
    const finalResult = await rateLimiter.check(config.key, config);
    if (this.options.throwOnRateLimit && !finalResult.allowed) {
      throw new RateLimitError(finalResult, `gemini:${this.modelName}`);
    }
    return finalResult;
  }

  /**
   * Get a generative model instance
   */
  getGenerativeModel(): GenerativeModel {
    if (!this.genAI) {
      throw new Error("Gemini API key is not configured");
    }
    return this.genAI.getGenerativeModel({ model: this.modelName });
  }

  /**
   * Generate content with rate limiting
   */
  async generateContent(parts: ContentPart[]): Promise<GenerateContentResult> {
    if (!this.genAI) {
      throw new Error("Gemini API key is not configured");
    }

    // Acquire rate limit slot (with retries)
    await this.acquireRateLimitSlot();

    logger.info(`[RateLimitedGemini] Sending request to Gemini`, {
      model: this.modelName,
    });

    try {
      const model = this.getGenerativeModel();
      const result = await model.generateContent(parts);
      const response = await result.response;

      logger.info(`[RateLimitedGemini] Received response from Gemini`, {
        model: this.modelName,
      });

      return {
        response: {
          text: () => response.text(),
        },
      };
    } catch (error) {
      // Check if this is a Gemini rate limit error (429)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit")) {
        logger.warn("[RateLimitedGemini] Gemini API returned rate limit error", {
          model: this.modelName,
          error: errorMessage,
        });

        // Re-throw as RateLimitError for consistent handling
        const config = this.getRateLimitConfig();
        const status = await rateLimiter.getStatus(config.key, config);
        throw new RateLimitError(
          {
            ...status,
            allowed: false,
            retryAfterMs: 60000, // Default 1 minute wait for Gemini 429s
          },
          `gemini:${this.modelName}`
        );
      }

      throw error;
    }
  }

  /**
   * Reset the rate limit counter (useful for testing or manual intervention)
   */
  async resetRateLimit(): Promise<void> {
    const config = this.getRateLimitConfig();
    await rateLimiter.reset(config.key);
    logger.info("[RateLimitedGemini] Rate limit reset", { model: this.modelName });
  }
}

/**
 * Create a rate-limited Gemini client
 */
export function createRateLimitedGeminiClient(
  apiKey: string | undefined,
  model: GeminiModel,
  options?: RateLimitedGeminiOptions
): RateLimitedGeminiClient {
  return new RateLimitedGeminiClient(apiKey, model, options);
}
