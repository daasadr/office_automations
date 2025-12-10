/**
 * Workflow Routes
 * API endpoints for managing document processing workflows
 */

import { Router } from "express";
import { pdfWorkflowQueue, JOB_NAMES, QUEUE_NAMES } from "@orchestration-api/queues";
import { workflowService } from "@orchestration-api/services/WorkflowService";
import { logger } from "@orchestration-api/utils/logger";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Workflow:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         state:
 *           type: string
 *           enum: [queued, splitting, processing, aggregating, erp_sync, completed, failed, cancelled]
 *         type:
 *           type: string
 *           enum: [pdf_processing, email_ingest, erp_sync_only]
 *         source:
 *           type: string
 *           enum: [upload, email, api, manual]
 *         input_file_name:
 *           type: string
 *         total_steps:
 *           type: integer
 *         completed_steps:
 *           type: integer
 *         date_created:
 *           type: string
 *           format: date-time
 *         date_updated:
 *           type: string
 *           format: date-time
 *
 *     WorkflowStep:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         kind:
 *           type: string
 *         state:
 *           type: string
 *           enum: [queued, running, succeeded, failed, skipped]
 *         page_number:
 *           type: integer
 *         attempts:
 *           type: integer
 *
 *     CreateWorkflowRequest:
 *       type: object
 *       required:
 *         - fileKey
 *       properties:
 *         fileKey:
 *           type: string
 *           description: MinIO key of the uploaded file
 *         fileName:
 *           type: string
 *           description: Original filename
 *         mimeType:
 *           type: string
 *           description: MIME type of the file
 *         source:
 *           type: string
 *           enum: [upload, email, api, manual]
 *           default: upload
 *         priority:
 *           type: integer
 *           default: 1
 *         tenantId:
 *           type: string
 *           description: Optional tenant ID for multi-tenant setups
 */

/**
 * @swagger
 * /workflows/pdf:
 *   post:
 *     summary: Create a new PDF processing workflow
 *     description: Initiates a new PDF processing workflow. The PDF will be split into pages and processed by LLM.
 *     tags: [Workflows]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWorkflowRequest'
 *     responses:
 *       202:
 *         description: Workflow created and queued for processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflowId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   example: queued
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */
router.post("/pdf", async (req, res, next) => {
  try {
    const { fileKey, fileName, mimeType, source, priority, tenantId } = req.body;

    // Validate required fields
    if (!fileKey) {
      return res.status(400).json({
        error: "fileKey is required",
      });
    }

    logger.info("[WorkflowRoutes] Creating PDF workflow", {
      fileKey,
      fileName,
      source,
    });

    // 1. Create workflow record in DB
    const workflow = await workflowService.createWorkflow({
      type: "pdf_processing",
      source: source || "upload",
      inputFileKey: fileKey,
      inputFileName: fileName || "unknown.pdf",
      inputFileMime: mimeType || "application/pdf",
      tenantId,
      metadata: { priority },
    });

    // 2. Add job to queue
    const job = await pdfWorkflowQueue.add(
      JOB_NAMES.PDF_WORKFLOW.START,
      {
        workflowId: workflow.id!,
        fileKey,
        fileName,
        mimeType,
        priority,
        tenantId,
      },
      {
        jobId: workflow.id!, // Prevents duplicate workflows
        priority: priority || 1,
      }
    );

    // 3. Update workflow with BullMQ job ID
    await workflowService.updateWorkflowState(workflow.id!, "queued", {
      bullmq_job_id: job.id,
    });

    logger.info("[WorkflowRoutes] PDF workflow created and queued", {
      workflowId: workflow.id,
      jobId: job.id,
    });

    res.status(202).json({
      workflowId: workflow.id,
      status: "queued",
      message: "Workflow created and queued for processing",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     description: Retrieves a workflow with all its steps
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workflow ID
 *     responses:
 *       200:
 *         description: Workflow details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflow:
 *                   $ref: '#/components/schemas/Workflow'
 *                 steps:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkflowStep'
 *                 progress:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     completed:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     percentage:
 *                       type: number
 *       404:
 *         description: Workflow not found
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await workflowService.getWorkflowWithSteps(id);

    if (!result) {
      return res.status(404).json({
        error: "Workflow not found",
      });
    }

    const { workflow, steps } = result;

    // Calculate progress
    const total = steps.length;
    const completed = steps.filter((s) => s.state === "succeeded").length;
    const failed = steps.filter((s) => s.state === "failed").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      workflow,
      steps,
      progress: {
        total,
        completed,
        failed,
        percentage,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflows:
 *   get:
 *     summary: List recent workflows
 *     description: Returns a list of recent workflows with optional filtering
 *     tags: [Workflows]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           enum: [queued, splitting, processing, aggregating, erp_sync, completed, failed, cancelled]
 *         description: Filter by workflow state
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [pdf_processing, email_ingest, erp_sync_only]
 *         description: Filter by workflow type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of workflows to return
 *     responses:
 *       200:
 *         description: List of workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workflow'
 *                 total:
 *                   type: integer
 */
router.get("/", async (req, res, next) => {
  try {
    const { state, type, limit } = req.query;

    const workflows = await workflowService.getRecentWorkflows({
      state: state as string | undefined,
      type: type as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    res.json({
      workflows,
      total: workflows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflows/{id}/cancel:
 *   post:
 *     summary: Cancel a workflow
 *     description: Cancels a workflow if it's still in a cancellable state
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Workflow cancelled
 *       400:
 *         description: Workflow cannot be cancelled (already completed or failed)
 *       404:
 *         description: Workflow not found
 */
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.getWorkflow(id);

    if (!workflow) {
      return res.status(404).json({
        error: "Workflow not found",
      });
    }

    // Check if workflow can be cancelled
    const terminalStates = ["completed", "failed", "cancelled"];
    if (terminalStates.includes(workflow.state || "")) {
      return res.status(400).json({
        error: `Workflow cannot be cancelled: already in ${workflow.state} state`,
      });
    }

    // Cancel the workflow
    await workflowService.updateWorkflowState(id, "cancelled");

    logger.info("[WorkflowRoutes] Workflow cancelled", { workflowId: id });

    res.json({
      message: "Workflow cancelled",
      workflowId: id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflows/{id}/retry:
 *   post:
 *     summary: Retry a failed workflow
 *     description: Retries a failed workflow by re-queuing it
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       202:
 *         description: Workflow queued for retry
 *       400:
 *         description: Workflow cannot be retried
 *       404:
 *         description: Workflow not found
 */
router.post("/:id/retry", async (req, res, next) => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.getWorkflow(id);

    if (!workflow) {
      return res.status(404).json({
        error: "Workflow not found",
      });
    }

    // Only allow retry of failed workflows
    if (workflow.state !== "failed") {
      return res.status(400).json({
        error: `Workflow cannot be retried: currently in ${workflow.state} state`,
      });
    }

    // Reset workflow state and re-queue
    await workflowService.updateWorkflowState(id, "queued", {
      error_summary: undefined,
      finished_at: undefined,
    });

    const job = await pdfWorkflowQueue.add(
      JOB_NAMES.PDF_WORKFLOW.START,
      {
        workflowId: id,
        fileKey: workflow.input_file_key!,
        fileName: workflow.input_file_name,
        mimeType: workflow.input_file_mime,
      },
      {
        jobId: `${id}-retry-${Date.now()}`, // New job ID for retry
      }
    );

    logger.info("[WorkflowRoutes] Workflow queued for retry", {
      workflowId: id,
      jobId: job.id,
    });

    res.status(202).json({
      message: "Workflow queued for retry",
      workflowId: id,
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /workflows/stats:
 *   get:
 *     summary: Get workflow statistics
 *     description: Returns aggregate statistics about workflows
 *     tags: [Workflows]
 *     responses:
 *       200:
 *         description: Workflow statistics
 */
router.get("/stats", async (req, res, next) => {
  try {
    // Get counts by state
    const [queued, processing, completed, failed] = await Promise.all([
      workflowService.getRecentWorkflows({ state: "queued", limit: 1000 }),
      workflowService.getRecentWorkflows({ state: "processing", limit: 1000 }),
      workflowService.getRecentWorkflows({ state: "completed", limit: 1000 }),
      workflowService.getRecentWorkflows({ state: "failed", limit: 1000 }),
    ]);

    // Get queue stats
    const queueStats = await pdfWorkflowQueue.getJobCounts();

    res.json({
      workflows: {
        queued: queued.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length,
        total: queued.length + processing.length + completed.length + failed.length,
      },
      queue: queueStats,
    });
  } catch (error) {
    next(error);
  }
});

export const workflowRouter = router;
