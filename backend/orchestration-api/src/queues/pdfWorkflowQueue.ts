/**
 * PDF Workflow Queue
 * Handles orchestration of PDF document processing workflows
 */

import { createQueue, createQueueEvents } from "@orchestration-api/config/bullmq";
import type { PdfWorkflowJobData } from "./types";
import { QUEUE_NAMES } from "./types";

/**
 * Queue for PDF workflow orchestration
 *
 * This queue handles:
 * - Starting new PDF processing workflows
 * - Splitting PDFs into pages
 * - Coordinating page processing jobs
 */
export const pdfWorkflowQueue = createQueue<PdfWorkflowJobData>(QUEUE_NAMES.PDF_WORKFLOW, {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
});

/**
 * Queue events for monitoring PDF workflow jobs
 */
export const pdfWorkflowEvents = createQueueEvents(QUEUE_NAMES.PDF_WORKFLOW);
