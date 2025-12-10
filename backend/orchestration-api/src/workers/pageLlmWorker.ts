/**
 * Page LLM Worker
 * Processes individual pages with LLM for data extraction
 *
 * This worker handles:
 * - Fetching page content from MinIO
 * - Running LLM analysis on each page
 * - Storing LLM results
 * - Checking workflow completion
 */

import { Worker } from "bullmq";
import { connection } from "@orchestration-api/config/bullmq";
import {
  QUEUE_NAMES,
  JOB_NAMES,
  type PageLlmJobData,
  type ErpSyncJobData,
} from "@orchestration-api/queues/types";
import { erpSyncQueue } from "@orchestration-api/queues";
import { workflowService } from "@orchestration-api/services/WorkflowService";
import { validatePdfContentWithGemini } from "@orchestration-api/services/llm";
import { downloadFile } from "@orchestration-api/lib/minio";
import { logger } from "@orchestration-api/utils/logger";
import { config } from "@orchestration-api/config";

// Initialize Sentry for error tracking
import { initializeSentry } from "@orchestration-api/lib/sentry";
initializeSentry();

/**
 * Fetches page content from MinIO
 */
async function getPageContent(workflowId: string, pageFileKey: string): Promise<ArrayBuffer> {
  logger.debug("[LlmWorker] Fetching page content", { workflowId, pageFileKey });

  try {
    // Download the page PDF from MinIO
    const buffer = await downloadFile(pageFileKey);

    // Convert Buffer to ArrayBuffer for Gemini API
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    logger.debug("[LlmWorker] Page content fetched", {
      workflowId,
      pageFileKey,
      size: arrayBuffer.byteLength,
    });

    return arrayBuffer;
  } catch (error) {
    logger.error("[LlmWorker] Failed to fetch page content", {
      workflowId,
      pageFileKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Checks if a page has already been processed (for idempotency)
 */
async function isPageAlreadyProcessed(workflowId: string, stepId: string): Promise<boolean> {
  const step = await workflowService.getWorkflowStep(stepId);
  return step?.state === "succeeded";
}

/**
 * Handles workflow completion after all pages are processed
 */
async function handleWorkflowCompletion(workflowId: string): Promise<void> {
  const { allDone, hasFailures } = await workflowService.shouldWorkflowComplete(workflowId);

  if (!allDone) {
    logger.debug("[LlmWorker] Workflow not yet complete", { workflowId });
    return;
  }

  const counts = await workflowService.countCompletedSteps(workflowId);

  // Update completed steps count
  await workflowService.updateWorkflowProgress(workflowId, undefined, counts.completed);

  if (hasFailures) {
    logger.warn("[LlmWorker] Workflow completed with failures", {
      workflowId,
      completed: counts.completed,
      failed: counts.failed,
      total: counts.total,
    });

    await workflowService.updateWorkflowState(workflowId, "failed", {
      error_summary: {
        code: "PARTIAL_FAILURE",
        message: `${counts.failed} of ${counts.total} pages failed to process`,
      },
    });
  } else {
    logger.info("[LlmWorker] All pages processed successfully", {
      workflowId,
      totalPages: counts.total,
    });

    // Move to aggregation or completion
    await workflowService.updateWorkflowState(workflowId, "aggregating");

    // TODO: Trigger aggregation step if needed
    // For now, mark as completed
    await workflowService.updateWorkflowState(workflowId, "completed");
  }
}

/**
 * Page LLM Worker
 */
const worker = new Worker<PageLlmJobData>(
  QUEUE_NAMES.PAGE_LLM,
  async (job) => {
    const { workflowId, stepId, pageId, pageNumber, pageFileKey, totalPages } = job.data;
    const startTime = Date.now();

    logger.info("[LlmWorker] Processing page", {
      jobId: job.id,
      workflowId,
      stepId,
      pageNumber,
      totalPages,
    });

    try {
      // Idempotency check - skip if already processed
      if (await isPageAlreadyProcessed(workflowId, stepId)) {
        logger.info("[LlmWorker] Page already processed, skipping", {
          workflowId,
          stepId,
          pageNumber,
        });
        return { skipped: true, pageNumber };
      }

      // 1. Update step state to 'running'
      await workflowService.updateStepState(stepId, "running");

      // 2. Fetch page content from MinIO
      const pageContent = await getPageContent(workflowId, pageFileKey);

      // 3. Run LLM analysis
      let llmResult: Record<string, unknown>;
      let extractedText: string | undefined;

      try {
        // Use the existing Gemini validation function
        const validationResult = await validatePdfContentWithGemini(pageContent);

        llmResult = {
          present_fields: validationResult.present_fields,
          missing_fields: validationResult.missing_fields,
          confidence: validationResult.confidence,
          extracted_data: validationResult.extracted_data,
          provider: validationResult.provider,
        };

        logger.info("[LlmWorker] LLM analysis complete", {
          workflowId,
          pageNumber,
          confidence: validationResult.confidence,
          presentFields: validationResult.present_fields.length,
          extractedDataCount: validationResult.extracted_data.length,
        });
      } catch (llmError) {
        // Handle LLM-specific errors
        const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);

        // Check if it's a rate limit error (should retry)
        if (errorMessage.includes("rate") || errorMessage.includes("429")) {
          logger.warn("[LlmWorker] Rate limited, will retry", {
            workflowId,
            pageNumber,
            error: errorMessage,
          });
          throw llmError; // Let BullMQ handle retry with backoff
        }

        // For other errors, mark step as failed but don't throw
        // (allows other pages to continue processing)
        await workflowService.setStepError(stepId, {
          code: "LLM_ERROR",
          message: errorMessage,
        });

        // Check workflow completion
        await handleWorkflowCompletion(workflowId);

        return {
          success: false,
          pageNumber,
          error: errorMessage,
        };
      }

      // 4. Save LLM result to document page
      await workflowService.updateDocumentPageLlmResult(pageId, llmResult, extractedText);

      // 5. Update step metadata with processing info
      const processingTime = Date.now() - startTime;
      await workflowService.updateStepState(stepId, "succeeded", {
        metadata: {
          processingTimeMs: processingTime,
          modelName: config.gemini.model,
          confidence: (llmResult as { confidence?: number }).confidence,
        },
      });

      // 6. Check if workflow should complete
      await handleWorkflowCompletion(workflowId);

      logger.info("[LlmWorker] Page processed successfully", {
        jobId: job.id,
        workflowId,
        pageNumber,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        pageId,
        pageNumber,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("[LlmWorker] Page processing failed", {
        jobId: job.id,
        workflowId,
        stepId,
        pageNumber,
        error: errorMessage,
        attempts: job.attemptsMade,
      });

      // Only set error if this is the last attempt
      if (job.attemptsMade >= (job.opts.attempts || 5)) {
        await workflowService.setStepError(stepId, {
          code: "PAGE_PROCESSING_ERROR",
          message: errorMessage,
          stack: errorStack,
        });

        // Check workflow completion
        await handleWorkflowCompletion(workflowId);
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: 3, // Limit concurrent LLM calls to avoid rate limits
  }
);

// Event handlers
worker.on("completed", (job) => {
  logger.debug("[LlmWorker] Job completed", {
    jobId: job.id,
    workflowId: job.data.workflowId,
    pageNumber: job.data.pageNumber,
  });
});

worker.on("failed", (job, error) => {
  logger.error("[LlmWorker] Job failed", {
    jobId: job?.id,
    workflowId: job?.data?.workflowId,
    pageNumber: job?.data?.pageNumber,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

worker.on("error", (error) => {
  logger.error("[LlmWorker] Worker error", { error: error.message });
});

// Graceful shutdown
async function shutdown() {
  logger.info("[LlmWorker] Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("[LlmWorker] Page LLM worker started", {
  queue: QUEUE_NAMES.PAGE_LLM,
  concurrency: 3,
});
