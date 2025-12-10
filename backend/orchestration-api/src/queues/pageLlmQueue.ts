/**
 * Page LLM Queue
 * Handles individual page processing with LLM
 */

import { createQueue, createQueueEvents } from "@orchestration-api/config/bullmq";
import type { PageLlmJobData } from "./types";
import { QUEUE_NAMES } from "./types";

/**
 * Queue for page-level LLM processing
 *
 * This queue handles:
 * - Extracting text/content from individual pages
 * - Running LLM analysis on page content
 * - Storing LLM results per page
 *
 * Configuration optimized for LLM workloads:
 * - Higher retry attempts (LLM services can be flaky)
 * - Longer backoff delays (rate limiting)
 * - Longer retention for debugging
 */
export const pageLlmQueue = createQueue<PageLlmJobData>(QUEUE_NAMES.PAGE_LLM, {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 8000, // Start with 8s, then 16s, 32s, etc.
  },
  removeOnComplete: {
    count: 5000,
    age: 48 * 60 * 60, // 48 hours
  },
  removeOnFail: {
    count: 10000,
    age: 14 * 24 * 60 * 60, // 14 days
  },
});

/**
 * Queue events for monitoring page LLM jobs
 */
export const pageLlmEvents = createQueueEvents(QUEUE_NAMES.PAGE_LLM);
