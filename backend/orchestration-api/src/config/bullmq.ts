/**
 * BullMQ Configuration
 * Shared connection and queue options for all queues and workers
 */

import { Queue, Worker, QueueEvents, type ConnectionOptions } from "bullmq";
import { config } from "@orchestration-api/config";
import { logger } from "@orchestration-api/utils/logger";

/**
 * Redis/KeyDB connection options for BullMQ
 */
export const connection: ConnectionOptions = {
  host: config.keydb.host,
  port: config.keydb.port,
  password: config.keydb.password || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ workers
};

/**
 * Default job options shared across queues
 */
export const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 60 * 60, // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 60 * 60, // 7 days
  },
};

/**
 * Creates a new queue with shared configuration
 */
export function createQueue<T>(name: string, options?: Partial<typeof defaultJobOptions>) {
  logger.info(`[BullMQ] Creating queue: ${name}`);
  return new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      ...defaultJobOptions,
      ...options,
    },
  });
}

/**
 * Creates queue events listener for monitoring
 */
export function createQueueEvents(queueName: string) {
  const events = new QueueEvents(queueName, { connection });

  events.on("completed", ({ jobId }) => {
    logger.debug(`[BullMQ] Job ${jobId} completed in queue ${queueName}`);
  });

  events.on("failed", ({ jobId, failedReason }) => {
    logger.error(`[BullMQ] Job ${jobId} failed in queue ${queueName}`, {
      queue: queueName,
      jobId,
      reason: failedReason,
    });
  });

  events.on("stalled", ({ jobId }) => {
    logger.warn(`[BullMQ] Job ${jobId} stalled in queue ${queueName}`, {
      queue: queueName,
      jobId,
    });
  });

  return events;
}

// Re-export BullMQ classes for convenience
export { Queue, Worker, QueueEvents };
