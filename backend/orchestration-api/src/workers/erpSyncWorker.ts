/**
 * ERP Sync Worker
 * Handles reliable synchronization with ERP/IFS system
 *
 * This worker implements the outbox pattern:
 * - All ERP operations are first persisted to erp_outbox table
 * - This worker processes the outbox queue
 * - Implements retry with exponential backoff
 * - Distinguishes between transient and permanent failures
 */

import { Worker } from "bullmq";
import { connection } from "@orchestration-api/config/bullmq";
import {
  QUEUE_NAMES,
  type ErpSyncJobData,
  type ErpOperation,
} from "@orchestration-api/queues/types";
import { workflowService } from "@orchestration-api/services/WorkflowService";
import { logger } from "@orchestration-api/utils/logger";
import { config } from "@orchestration-api/config";

// Initialize Sentry for error tracking
import { initializeSentry } from "@orchestration-api/lib/sentry";
initializeSentry();

/**
 * Custom error class for permanent business errors
 * These errors should not be retried
 */
class PermanentBusinessError extends Error {
  public readonly isPermanentBusinessError = true;
  public readonly externalCode?: string;

  constructor(message: string, externalCode?: string) {
    super(message);
    this.name = "PermanentBusinessError";
    this.externalCode = externalCode;
  }
}

/**
 * ERP Client (placeholder - implement with actual ERP/IFS integration)
 */
const erpClient = {
  /**
   * Executes an ERP operation
   */
  async execute(
    operation: ErpOperation,
    payload: Record<string, unknown>
  ): Promise<{ erpObjectId: string; erpObjectType: string }> {
    logger.info("[ErpWorker] Executing ERP operation", { operation, payload });

    // TODO: Implement actual ERP/IFS API calls
    // This is a placeholder that simulates ERP operations

    // Simulate different outcomes based on operation
    switch (operation) {
      case "create_invoice":
        // Simulate invoice creation
        return {
          erpObjectId: `INV-${Date.now()}`,
          erpObjectType: "Invoice",
        };

      case "update_vendor":
        // Simulate vendor update
        return {
          erpObjectId: (payload.vendorId as string) || `VND-${Date.now()}`,
          erpObjectType: "Vendor",
        };

      case "link_document":
        // Simulate document linking
        return {
          erpObjectId: (payload.documentId as string) || `DOC-${Date.now()}`,
          erpObjectType: "Document",
        };

      default:
        throw new Error(`Unknown ERP operation: ${operation}`);
    }
  },

  /**
   * Validates payload before sending to ERP
   */
  validatePayload(
    operation: ErpOperation,
    payload: Record<string, unknown>
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Basic validation based on operation type
    switch (operation) {
      case "create_invoice":
        if (!payload.amount) errors.push("amount is required");
        if (!payload.vendorId) errors.push("vendorId is required");
        break;

      case "update_vendor":
        if (!payload.vendorId) errors.push("vendorId is required");
        break;

      case "link_document":
        if (!payload.documentId) errors.push("documentId is required");
        if (!payload.targetObjectId) errors.push("targetObjectId is required");
        break;
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * ERP Sync Worker
 */
const worker = new Worker<ErpSyncJobData>(
  QUEUE_NAMES.ERP_SYNC,
  async (job) => {
    const { outboxId, workflowId, stepId, operation } = job.data;
    const startTime = Date.now();

    logger.info("[ErpWorker] Processing ERP sync job", {
      jobId: job.id,
      outboxId,
      workflowId,
      operation,
    });

    try {
      // 1. Get outbox entry
      const outboxEntry = await workflowService.getErpOutboxEntry(outboxId);

      if (!outboxEntry) {
        logger.warn("[ErpWorker] Outbox entry not found", { outboxId });
        return { success: false, error: "Outbox entry not found" };
      }

      // Skip if already sent
      if (outboxEntry.state === "sent") {
        logger.info("[ErpWorker] Outbox entry already sent, skipping", { outboxId });
        return { success: true, skipped: true };
      }

      // 2. Update outbox state to 'in_progress'
      await workflowService.updateErpOutboxState(outboxId, "in_progress");

      // 3. Validate payload
      const validation = erpClient.validatePayload(
        outboxEntry.operation as ErpOperation,
        outboxEntry.payload as Record<string, unknown>
      );

      if (!validation.valid) {
        // Permanent validation error - don't retry
        throw new PermanentBusinessError(
          `Invalid payload: ${validation.errors?.join(", ")}`,
          "VALIDATION_ERROR"
        );
      }

      // 4. Execute ERP operation
      const result = await erpClient.execute(
        outboxEntry.operation as ErpOperation,
        outboxEntry.payload as Record<string, unknown>
      );

      // 5. Mark as sent
      await workflowService.markErpOutboxSent(outboxId, result.erpObjectId, result.erpObjectType);

      const processingTime = Date.now() - startTime;
      logger.info("[ErpWorker] ERP operation completed", {
        jobId: job.id,
        outboxId,
        operation,
        erpObjectId: result.erpObjectId,
        erpObjectType: result.erpObjectType,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        outboxId,
        erpObjectId: result.erpObjectId,
        erpObjectType: result.erpObjectType,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("[ErpWorker] ERP operation failed", {
        jobId: job.id,
        outboxId,
        operation,
        error: errorMessage,
        attempts: job.attemptsMade,
      });

      // Handle permanent business errors - mark as failed, don't retry
      if (error instanceof PermanentBusinessError) {
        await workflowService.setErpOutboxError(outboxId, {
          code: error.externalCode || "BUSINESS_ERROR",
          message: errorMessage,
        });

        // Don't throw - this prevents BullMQ from retrying
        return {
          success: false,
          outboxId,
          error: errorMessage,
          permanent: true,
        };
      }

      // For transient errors, update outbox and let BullMQ retry
      await workflowService.updateErpOutboxState(outboxId, "pending", {
        last_error: {
          code: "TRANSIENT_ERROR",
          message: errorMessage,
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // ERP systems are often fragile, keep concurrency low
  }
);

// Event handlers
worker.on("completed", (job) => {
  logger.debug("[ErpWorker] Job completed", {
    jobId: job.id,
    outboxId: job.data.outboxId,
  });
});

worker.on("failed", (job, error) => {
  logger.error("[ErpWorker] Job failed", {
    jobId: job?.id,
    outboxId: job?.data?.outboxId,
    operation: job?.data?.operation,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

worker.on("error", (error) => {
  logger.error("[ErpWorker] Worker error", { error: error.message });
});

// Graceful shutdown
async function shutdown() {
  logger.info("[ErpWorker] Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("[ErpWorker] ERP sync worker started", {
  queue: QUEUE_NAMES.ERP_SYNC,
  concurrency: 1,
});
