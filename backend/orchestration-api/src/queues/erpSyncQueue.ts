/**
 * ERP Sync Queue
 * Handles reliable synchronization with ERP/IFS system
 */

import { createQueue, createQueueEvents } from "@orchestration-api/config/bullmq";
import type { ErpSyncJobData } from "./types";
import { QUEUE_NAMES } from "./types";

/**
 * Queue for ERP synchronization operations
 *
 * This queue implements the outbox pattern for reliable ERP integration:
 * - All ERP operations go through this queue
 * - Operations are persisted in erp_outbox table before queuing
 * - High retry count for transient failures
 * - Long backoff to handle ERP rate limits and downtime
 *
 * Configuration optimized for ERP integration:
 * - Very high retry attempts (ERP systems can be unavailable)
 * - Long backoff delays (respect ERP rate limits)
 * - Very long retention for audit trails
 */
export const erpSyncQueue = createQueue<ErpSyncJobData>(QUEUE_NAMES.ERP_SYNC, {
  attempts: 10,
  backoff: {
    type: "exponential",
    delay: 10000, // Start with 10s, doubles each attempt
  },
  removeOnComplete: {
    count: 10000,
    age: 30 * 24 * 60 * 60, // 30 days
  },
  removeOnFail: {
    count: 20000,
    age: 90 * 24 * 60 * 60, // 90 days for audit
  },
});

/**
 * Queue events for monitoring ERP sync jobs
 */
export const erpSyncEvents = createQueueEvents(QUEUE_NAMES.ERP_SYNC);
