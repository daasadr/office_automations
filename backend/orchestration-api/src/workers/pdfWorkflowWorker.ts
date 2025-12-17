/**
 * PDF Workflow Worker
 * Orchestrates PDF document processing workflows
 *
 * This worker handles:
 * - Starting new PDF processing workflows
 * - Splitting PDFs into individual pages
 * - Creating workflow steps for each page
 * - Enqueueing page LLM jobs
 */

import { Worker } from "bullmq";
import { connection } from "@orchestration-api/config/bullmq";
import {
  QUEUE_NAMES,
  JOB_NAMES,
  type PdfWorkflowJobData,
  type PageLlmJobData,
} from "@orchestration-api/queues/types";
import { pageLlmQueue } from "@orchestration-api/queues";
import { workflowService } from "@orchestration-api/services/WorkflowService";
import { pdfSplitService } from "@orchestration-api/services/PdfSplitService";
import { logger } from "@orchestration-api/utils/logger";
import { config } from "@orchestration-api/config";

// Initialize Sentry for error tracking
import { initializeSentry } from "@orchestration-api/lib/sentry";
initializeSentry();

/**
 * PDF Workflow Worker
 */
const worker = new Worker<PdfWorkflowJobData>(
  QUEUE_NAMES.PDF_WORKFLOW,
  async (job) => {
    const { workflowId, fileKey, fileName } = job.data;
    const startTime = Date.now();

    logger.info("[PdfWorker] Starting PDF workflow", {
      jobId: job.id,
      workflowId,
      fileKey,
      fileName,
    });

    try {
      // 1. Update workflow state to 'splitting'
      await workflowService.updateWorkflowState(workflowId, "splitting");

      // 2. Split PDF into pages using the actual PDF split service
      const splitResult = await pdfSplitService.splitPdfIntoPages({
        workflowId,
        fileId,
      });

      const pages = splitResult.pages;

      // 3. Create a document record for this PDF
      const document = await workflowService.createDocument({
        workflowId,
        fileKey: fileId, // Store Directus file ID
        fileName: fileName || "unknown.pdf",
        mimeType: "application/pdf",
        source: "upload",
        metadata: {
          totalPages: pages.length,
          originalFileId: fileId,
        },
      });

      // 4. Create workflow steps for each page
      const steps = await workflowService.createPageSteps(
        workflowId,
        pages.map((p) => ({ pageNumber: p.pageNumber, fileKey: p.fileId })),
        QUEUE_NAMES.PAGE_LLM
      );

      // 5. Update workflow with total steps count
      await workflowService.updateWorkflowProgress(workflowId, steps.length, 0);

      // 6. Create document page records and enqueue LLM jobs
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const step = steps[i];

        // Create document page record
        const docPage = await workflowService.createDocumentPage({
          documentId: document.id!,
          workflowStepId: step.id,
          pageNumber: page.pageNumber,
          fileKey: page.fileId, // Store Directus file ID
          metadata: { mimeType: page.mimeType },
        });

        // Enqueue LLM job for this page
        const llmJobData: PageLlmJobData = {
          workflowId,
          stepId: step.id!,
          pageId: docPage.id!,
          pageNumber: page.pageNumber,
          pageFileId: page.fileId, // Use Directus file ID
          totalPages: pages.length,
        };

        await pageLlmQueue.add(JOB_NAMES.PAGE_LLM.PROCESS_PAGE, llmJobData, {
          jobId: `${workflowId}:${step.id}`, // Idempotent per step
          priority: 1,
        });

        logger.debug("[PdfWorker] Enqueued page LLM job", {
          workflowId,
          stepId: step.id,
          pageNumber: page.pageNumber,
        });
      }

      // 7. Update workflow state to 'processing'
      await workflowService.updateWorkflowState(workflowId, "processing");

      const processingTime = Date.now() - startTime;
      logger.info("[PdfWorker] PDF workflow started successfully", {
        jobId: job.id,
        workflowId,
        totalPages: splitResult.totalPages,
        extractedPages: pages.length,
        splitProcessingTimeMs: splitResult.processingTimeMs,
        totalProcessingTimeMs: processingTime,
      });

      return {
        success: true,
        workflowId,
        documentId: document.id,
        totalPages: splitResult.totalPages,
        extractedPages: pages.length,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("[PdfWorker] PDF workflow failed", {
        jobId: job.id,
        workflowId,
        error: errorMessage,
        stack: errorStack,
      });

      // Update workflow with error
      await workflowService.setWorkflowError(workflowId, {
        code: "PDF_WORKFLOW_ERROR",
        message: errorMessage,
        stack: errorStack,
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Limit concurrent PDF splits to avoid memory issues
  }
);

// Event handlers
worker.on("completed", (job) => {
  logger.info("[PdfWorker] Job completed", {
    jobId: job.id,
    workflowId: job.data.workflowId,
  });
});

worker.on("failed", (job, error) => {
  logger.error("[PdfWorker] Job failed", {
    jobId: job?.id,
    workflowId: job?.data?.workflowId,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

worker.on("error", (error) => {
  logger.error("[PdfWorker] Worker error", { error: error.message });
});

// Graceful shutdown
async function shutdown() {
  logger.info("[PdfWorker] Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("[PdfWorker] PDF workflow worker started", {
  queue: QUEUE_NAMES.PDF_WORKFLOW,
  concurrency: 2,
});
