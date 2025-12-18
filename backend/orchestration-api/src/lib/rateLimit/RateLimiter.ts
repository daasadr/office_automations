/**
 * Rate Limiter Implementation
 * Uses Redis/KeyDB with sliding window algorithm for distributed rate limiting
 */

import Redis from "ioredis";
import { config } from "@orchestration-api/config";
import { logger } from "@orchestration-api/utils/logger";
import type { IRateLimiter, RateLimitConfig, RateLimitResult, RateLimitWindow } from "./types";

/**
 * Convert window type to milliseconds
 */
function windowToMs(window: RateLimitWindow): number {
  switch (window) {
    case "second":
      return 1000;
    case "minute":
      return 60 * 1000;
    case "hour":
      return 60 * 60 * 1000;
    case "day":
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000; // Default to minute
  }
}

/**
 * Sliding Window Rate Limiter using Redis/KeyDB
 *
 * Uses a sliding window log algorithm for accurate rate limiting:
 * - Stores timestamps of each request in a sorted set
 * - Removes expired entries on each check
 * - Counts remaining entries to determine current usage
 *
 * This approach provides:
 * - Smooth rate limiting without burst issues at window boundaries
 * - Accurate request counting across distributed instances
 * - Automatic cleanup of old entries
 */
export class RateLimiter implements IRateLimiter {
  private redis: Redis | null = null;
  private readonly prefix: string;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(prefix = "ratelimit") {
    this.prefix = prefix;
  }

  /**
   * Initialize Redis connection lazily
   */
  private async ensureConnection(): Promise<Redis | null> {
    if (this.redis && this.isConnected) {
      return this.redis;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return this.redis;
    }

    this.connectionPromise = this.connect();
    await this.connectionPromise;
    return this.redis;
  }

  private async connect(): Promise<void> {
    try {
      if (!config.keydb.host) {
        logger.warn("[RateLimiter] KeyDB not configured, rate limiting disabled");
        return;
      }

      this.redis = new Redis({
        host: config.keydb.host,
        port: config.keydb.port,
        password: config.keydb.password || undefined,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.error("[RateLimiter] Failed to connect to Redis after 3 attempts");
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      this.redis.on("error", (err) => {
        logger.error("[RateLimiter] Redis connection error", { error: err.message });
        this.isConnected = false;
      });

      this.redis.on("connect", () => {
        logger.info("[RateLimiter] Connected to Redis/KeyDB");
        this.isConnected = true;
      });

      this.redis.on("close", () => {
        logger.warn("[RateLimiter] Redis connection closed");
        this.isConnected = false;
      });

      await this.redis.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error("[RateLimiter] Failed to connect to Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Generate Redis key for rate limit
   */
  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Check and consume a rate limit slot
   * Returns whether the request is allowed and updates the counter
   */
  async checkAndConsume(key: string, configParam: RateLimitConfig): Promise<RateLimitResult> {
    const redis = await this.ensureConnection();

    // If Redis is not available, allow the request (fail-open)
    if (!redis) {
      logger.warn("[RateLimiter] Redis unavailable, allowing request (fail-open)");
      return {
        allowed: true,
        remaining: configParam.maxRequests,
        limit: configParam.maxRequests,
        resetInMs: 0,
        retryAfterMs: 0,
        currentCount: 0,
      };
    }

    const redisKey = this.getKey(configParam.key);
    const windowMs = windowToMs(configParam.window);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Lua script for atomic operation
      const luaScript = `
        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
        
        -- Count current entries
        local count = redis.call('ZCARD', KEYS[1])
        
        -- Check if under limit
        if count < tonumber(ARGV[2]) then
          -- Add new entry with current timestamp
          redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
          -- Set expiry on the key
          redis.call('PEXPIRE', KEYS[1], ARGV[4])
          return {1, count + 1}
        else
          -- Get oldest entry to calculate reset time
          local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
          local resetTime = 0
          if oldest[2] then
            resetTime = tonumber(oldest[2]) + tonumber(ARGV[4]) - tonumber(ARGV[3])
          end
          return {0, count, resetTime}
        end
      `;

      const result = (await redis.eval(
        luaScript,
        1,
        redisKey,
        windowStart.toString(),
        configParam.maxRequests.toString(),
        now.toString(),
        windowMs.toString()
      )) as [number, number, number?];

      const allowed = result[0] === 1;
      const currentCount = result[1];
      const resetInMs = allowed ? windowMs : Math.max(0, result[2] || windowMs);
      const remaining = Math.max(0, configParam.maxRequests - currentCount);

      const response: RateLimitResult = {
        allowed,
        remaining,
        limit: configParam.maxRequests,
        resetInMs,
        retryAfterMs: allowed ? 0 : resetInMs,
        currentCount,
      };

      if (!allowed) {
        logger.warn("[RateLimiter] Rate limit exceeded", {
          key: configParam.key,
          currentCount,
          limit: configParam.maxRequests,
          retryAfterMs: response.retryAfterMs,
        });
      }

      return response;
    } catch (error) {
      logger.error("[RateLimiter] Error checking rate limit", {
        key: configParam.key,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fail-open on error
      return {
        allowed: true,
        remaining: configParam.maxRequests,
        limit: configParam.maxRequests,
        resetInMs: 0,
        retryAfterMs: 0,
        currentCount: 0,
      };
    }
  }

  /**
   * Check rate limit without consuming a slot
   */
  async check(key: string, configParam: RateLimitConfig): Promise<RateLimitResult> {
    const redis = await this.ensureConnection();

    if (!redis) {
      return {
        allowed: true,
        remaining: configParam.maxRequests,
        limit: configParam.maxRequests,
        resetInMs: 0,
        retryAfterMs: 0,
        currentCount: 0,
      };
    }

    const redisKey = this.getKey(configParam.key);
    const windowMs = windowToMs(configParam.window);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Remove expired and count
      await redis.zremrangebyscore(redisKey, "-inf", windowStart);
      const currentCount = await redis.zcard(redisKey);
      const remaining = Math.max(0, configParam.maxRequests - currentCount);
      const allowed = currentCount < configParam.maxRequests;

      let resetInMs = windowMs;
      if (!allowed) {
        const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
        if (oldest[1]) {
          resetInMs = Number.parseInt(oldest[1], 10) + windowMs - now;
        }
      }

      return {
        allowed,
        remaining,
        limit: configParam.maxRequests,
        resetInMs: Math.max(0, resetInMs),
        retryAfterMs: allowed ? 0 : Math.max(0, resetInMs),
        currentCount,
      };
    } catch (error) {
      logger.error("[RateLimiter] Error checking rate limit", {
        key: configParam.key,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        allowed: true,
        remaining: configParam.maxRequests,
        limit: configParam.maxRequests,
        resetInMs: 0,
        retryAfterMs: 0,
        currentCount: 0,
      };
    }
  }

  /**
   * Get current status without consuming
   */
  async getStatus(key: string, configParam: RateLimitConfig): Promise<RateLimitResult> {
    return this.check(key, configParam);
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    const redis = await this.ensureConnection();
    if (redis) {
      const redisKey = this.getKey(key);
      await redis.del(redisKey);
      logger.info("[RateLimiter] Rate limit reset", { key });
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      logger.info("[RateLimiter] Redis connection closed");
    }
  }
}

/**
 * Singleton rate limiter instance
 */
export const rateLimiter = new RateLimiter();
