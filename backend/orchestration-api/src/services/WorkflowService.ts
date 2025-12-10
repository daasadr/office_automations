/**
 * Workflow Service
 * Handles all database operations for workflows, steps, and related entities
 *
 * This service is the single source of truth for workflow state management,
 * ensuring consistency between BullMQ jobs and Postgres/Directus records.
 */

import { v4 as uuidv4 } from "uuid";
import { requireDirectus } from "@orchestration-api/lib/directus/client";
import { logger } from "@orchestration-api/utils/logger";
import { createItem, readItem, readItems, updateItem } from "@directus/sdk";
import type {
  Workflow,
  WorkflowStep,
  WorkflowStepRun,
  ErpOutbox,
  Document,
  DocumentPage,
} from "@orchestration-api/lib/directus/types";
import type {
  WorkflowType,
  WorkflowSource,
  WorkflowState,
  WorkflowStepKind,
  WorkflowStepState,
  ErpOutboxState,
  ErpOperation,
  WorkflowErrorDetail,
  WorkflowMetadata,
  StepMetadata,
} from "@orchestration-api/queues/types";

// ============================================================================
// Workflow Operations
// ============================================================================

/**
 * Creates a new workflow record
 */
export async function createWorkflow(params: {
  type: WorkflowType;
  source: WorkflowSource;
  inputFileKey: string;
  inputFileName: string;
  inputFileMime?: string;
  tenantId?: string;
  metadata?: WorkflowMetadata;
  bullmqJobId?: string;
}): Promise<Workflow> {
  const client = requireDirectus();
  const id = uuidv4();

  const workflow: Partial<Workflow> = {
    id,
    state: "queued",
    type: params.type,
    source: params.source,
    priority: 1,
    tenant: params.tenantId,
    input_file_key: params.inputFileKey,
    input_file_name: params.inputFileName,
    input_file_mime: params.inputFileMime,
    total_steps: 0,
    completed_steps: 0,
    metadata: params.metadata || {},
    bullmq_job_id: params.bullmqJobId,
  };

  logger.info("[WorkflowService] Creating workflow", {
    id,
    type: params.type,
    source: params.source,
    inputFileName: params.inputFileName,
  });

  const created = await client.request(createItem("workflows", workflow as Workflow));

  logger.info("[WorkflowService] Workflow created", { id });

  return created as Workflow;
}

/**
 * Gets a workflow by ID
 */
export async function getWorkflow(workflowId: string): Promise<Workflow | null> {
  const client = requireDirectus();

  try {
    const workflow = await client.request(readItem("workflows", workflowId));
    return workflow as Workflow;
  } catch (error) {
    logger.warn("[WorkflowService] Workflow not found", { workflowId });
    return null;
  }
}

/**
 * Gets a workflow with all its steps
 */
export async function getWorkflowWithSteps(workflowId: string): Promise<{
  workflow: Workflow;
  steps: WorkflowStep[];
} | null> {
  const client = requireDirectus();

  try {
    const workflow = await client.request(readItem("workflows", workflowId));

    const steps = await client.request(
      readItems("workflow_steps", {
        filter: { workflow: { _eq: workflowId } },
        sort: ["date_created"],
      })
    );

    return {
      workflow: workflow as Workflow,
      steps: steps as WorkflowStep[],
    };
  } catch (error) {
    logger.warn("[WorkflowService] Workflow not found", { workflowId });
    return null;
  }
}

/**
 * Updates workflow state
 */
export async function updateWorkflowState(
  workflowId: string,
  state: WorkflowState,
  additionalUpdates?: Partial<Workflow>
): Promise<Workflow> {
  const client = requireDirectus();

  const updates: Partial<Workflow> = {
    state,
    ...additionalUpdates,
  };

  // Set timestamps based on state transitions
  if (state === "splitting" || state === "processing") {
    updates.started_at = new Date().toISOString();
  }

  if (state === "completed" || state === "failed" || state === "cancelled") {
    updates.finished_at = new Date().toISOString();
  }

  logger.info("[WorkflowService] Updating workflow state", {
    workflowId,
    state,
  });

  const updated = await client.request(updateItem("workflows", workflowId, updates as Workflow));

  return updated as Workflow;
}

/**
 * Updates workflow progress counters
 */
export async function updateWorkflowProgress(
  workflowId: string,
  totalSteps?: number,
  completedSteps?: number
): Promise<Workflow> {
  const client = requireDirectus();

  const updates: Partial<Workflow> = {};
  if (totalSteps !== undefined) updates.total_steps = totalSteps;
  if (completedSteps !== undefined) updates.completed_steps = completedSteps;

  logger.debug("[WorkflowService] Updating workflow progress", {
    workflowId,
    totalSteps,
    completedSteps,
  });

  const updated = await client.request(updateItem("workflows", workflowId, updates as Workflow));

  return updated as Workflow;
}

/**
 * Sets workflow error
 */
export async function setWorkflowError(
  workflowId: string,
  error: WorkflowErrorDetail,
  lastStepId?: string
): Promise<Workflow> {
  const client = requireDirectus();

  const updates: Partial<Workflow> = {
    state: "failed",
    finished_at: new Date().toISOString(),
    error_summary: {
      ...error,
      last_step_id: lastStepId,
    },
  };

  logger.error("[WorkflowService] Setting workflow error", {
    workflowId,
    error,
    lastStepId,
  });

  const updated = await client.request(updateItem("workflows", workflowId, updates as Workflow));

  return updated as Workflow;
}

// ============================================================================
// Workflow Step Operations
// ============================================================================

/**
 * Creates a new workflow step
 */
export async function createWorkflowStep(params: {
  workflowId: string;
  kind: WorkflowStepKind;
  key: string;
  queue: string;
  jobId?: string;
  pageNumber?: number;
  maxAttempts?: number;
  metadata?: StepMetadata;
}): Promise<WorkflowStep> {
  const client = requireDirectus();
  const id = uuidv4();

  const step: Partial<WorkflowStep> = {
    id,
    workflow: params.workflowId,
    kind: params.kind,
    key: params.key,
    queue: params.queue,
    state: "queued",
    attempts: 0,
    max_attempts: params.maxAttempts || 5,
    job_id: params.jobId,
    page_number: params.pageNumber,
    metadata: params.metadata || {},
  };

  logger.debug("[WorkflowService] Creating workflow step", {
    id,
    workflowId: params.workflowId,
    kind: params.kind,
    key: params.key,
  });

  const created = await client.request(createItem("workflow_steps", step as WorkflowStep));

  return created as WorkflowStep;
}

/**
 * Creates multiple workflow steps in batch (for page processing)
 */
export async function createPageSteps(
  workflowId: string,
  pages: Array<{
    pageNumber: number;
    fileKey: string;
  }>,
  queue: string
): Promise<WorkflowStep[]> {
  const client = requireDirectus();
  const steps: WorkflowStep[] = [];

  for (const page of pages) {
    const id = uuidv4();
    const step: Partial<WorkflowStep> = {
      id,
      workflow: workflowId,
      kind: "page_llm",
      key: `page-${page.pageNumber}`,
      queue,
      state: "queued",
      attempts: 0,
      max_attempts: 5,
      page_number: page.pageNumber,
      metadata: { fileKey: page.fileKey },
    };

    const created = await client.request(createItem("workflow_steps", step as WorkflowStep));
    steps.push(created as WorkflowStep);
  }

  logger.info("[WorkflowService] Created page steps", {
    workflowId,
    count: steps.length,
  });

  return steps;
}

/**
 * Gets a workflow step by ID
 */
export async function getWorkflowStep(stepId: string): Promise<WorkflowStep | null> {
  const client = requireDirectus();

  try {
    const step = await client.request(readItem("workflow_steps", stepId));
    return step as WorkflowStep;
  } catch (error) {
    logger.warn("[WorkflowService] Step not found", { stepId });
    return null;
  }
}

/**
 * Updates step state
 */
export async function updateStepState(
  stepId: string,
  state: WorkflowStepState,
  additionalUpdates?: Partial<WorkflowStep>
): Promise<WorkflowStep> {
  const client = requireDirectus();

  const updates: Partial<WorkflowStep> = {
    state,
    ...additionalUpdates,
  };

  if (state === "running") {
    updates.started_at = new Date().toISOString();
    updates.attempts = ((await getWorkflowStep(stepId))?.attempts || 0) + 1;
  }

  if (state === "succeeded" || state === "failed" || state === "skipped") {
    updates.finished_at = new Date().toISOString();
  }

  logger.debug("[WorkflowService] Updating step state", {
    stepId,
    state,
  });

  const updated = await client.request(
    updateItem("workflow_steps", stepId, updates as WorkflowStep)
  );

  return updated as WorkflowStep;
}

/**
 * Sets step error
 */
export async function setStepError(
  stepId: string,
  error: WorkflowErrorDetail
): Promise<WorkflowStep> {
  const client = requireDirectus();

  const updates: Partial<WorkflowStep> = {
    state: "failed",
    finished_at: new Date().toISOString(),
    error_detail: error,
  };

  logger.error("[WorkflowService] Setting step error", {
    stepId,
    error,
  });

  const updated = await client.request(
    updateItem("workflow_steps", stepId, updates as WorkflowStep)
  );

  return updated as WorkflowStep;
}

/**
 * Gets all steps for a workflow
 */
export async function getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
  const client = requireDirectus();

  const steps = await client.request(
    readItems("workflow_steps", {
      filter: { workflow: { _eq: workflowId } },
      sort: ["page_number", "date_created"],
    })
  );

  return steps as WorkflowStep[];
}

/**
 * Counts completed steps for a workflow
 */
export async function countCompletedSteps(workflowId: string): Promise<{
  total: number;
  completed: number;
  failed: number;
  running: number;
}> {
  const steps = await getWorkflowSteps(workflowId);

  return {
    total: steps.length,
    completed: steps.filter((s) => s.state === "succeeded").length,
    failed: steps.filter((s) => s.state === "failed").length,
    running: steps.filter((s) => s.state === "running").length,
  };
}

/**
 * Checks if all steps are completed (succeeded or failed)
 */
export async function areAllStepsComplete(workflowId: string): Promise<boolean> {
  const counts = await countCompletedSteps(workflowId);
  return counts.completed + counts.failed === counts.total && counts.total > 0;
}

/**
 * Checks if workflow should complete (all steps done, no failures)
 */
export async function shouldWorkflowComplete(workflowId: string): Promise<{
  allDone: boolean;
  hasFailures: boolean;
}> {
  const counts = await countCompletedSteps(workflowId);

  return {
    allDone: counts.completed + counts.failed === counts.total && counts.total > 0,
    hasFailures: counts.failed > 0,
  };
}

// ============================================================================
// ERP Outbox Operations
// ============================================================================

/**
 * Creates an ERP outbox entry
 */
export async function createErpOutboxEntry(params: {
  workflowId?: string;
  stepId?: string;
  operation: ErpOperation;
  payload: Record<string, unknown>;
  erpObjectType?: string;
  metadata?: Record<string, unknown>;
}): Promise<ErpOutbox> {
  const client = requireDirectus();
  const id = uuidv4();

  const entry: Partial<ErpOutbox> = {
    id,
    workflow: params.workflowId,
    step: params.stepId,
    operation: params.operation,
    payload: params.payload,
    state: "pending",
    attempts: 0,
    erp_object_type: params.erpObjectType,
    metadata: params.metadata || {},
  };

  logger.info("[WorkflowService] Creating ERP outbox entry", {
    id,
    operation: params.operation,
    workflowId: params.workflowId,
  });

  const created = await client.request(createItem("erp_outbox", entry as ErpOutbox));

  return created as ErpOutbox;
}

/**
 * Gets an ERP outbox entry by ID
 */
export async function getErpOutboxEntry(outboxId: string): Promise<ErpOutbox | null> {
  const client = requireDirectus();

  try {
    const entry = await client.request(readItem("erp_outbox", outboxId));
    return entry as ErpOutbox;
  } catch (error) {
    logger.warn("[WorkflowService] ERP outbox entry not found", { outboxId });
    return null;
  }
}

/**
 * Updates ERP outbox entry state
 */
export async function updateErpOutboxState(
  outboxId: string,
  state: ErpOutboxState,
  additionalUpdates?: Partial<ErpOutbox>
): Promise<ErpOutbox> {
  const client = requireDirectus();

  const updates: Partial<ErpOutbox> = {
    state,
    ...additionalUpdates,
  };

  if (state === "sent") {
    updates.sent_at = new Date().toISOString();
  }

  if (state === "in_progress") {
    const current = await getErpOutboxEntry(outboxId);
    updates.attempts = (current?.attempts || 0) + 1;
  }

  logger.debug("[WorkflowService] Updating ERP outbox state", {
    outboxId,
    state,
  });

  const updated = await client.request(updateItem("erp_outbox", outboxId, updates as ErpOutbox));

  return updated as ErpOutbox;
}

/**
 * Sets ERP outbox entry error
 */
export async function setErpOutboxError(
  outboxId: string,
  error: WorkflowErrorDetail
): Promise<ErpOutbox> {
  const client = requireDirectus();

  const updates: Partial<ErpOutbox> = {
    state: "failed",
    last_error: error,
  };

  logger.error("[WorkflowService] Setting ERP outbox error", {
    outboxId,
    error,
  });

  const updated = await client.request(updateItem("erp_outbox", outboxId, updates as ErpOutbox));

  return updated as ErpOutbox;
}

/**
 * Marks ERP outbox entry as sent successfully
 */
export async function markErpOutboxSent(
  outboxId: string,
  erpObjectId: string,
  erpObjectType?: string
): Promise<ErpOutbox> {
  return updateErpOutboxState(outboxId, "sent", {
    erp_object_id: erpObjectId,
    erp_object_type: erpObjectType,
  });
}

// ============================================================================
// Document & Page Operations
// ============================================================================

/**
 * Creates a document record
 */
export async function createDocument(params: {
  workflowId?: string;
  companyId?: string;
  fileKey: string;
  fileName: string;
  mimeType?: string;
  source: WorkflowSource;
  metadata?: Record<string, unknown>;
}): Promise<Document> {
  const client = requireDirectus();
  const id = uuidv4();

  const doc: Partial<Document> = {
    id,
    workflow: params.workflowId,
    company: params.companyId,
    file_key: params.fileKey,
    file_name: params.fileName,
    mime_type: params.mimeType,
    source: params.source,
    metadata: params.metadata || {},
  };

  logger.info("[WorkflowService] Creating document", {
    id,
    fileName: params.fileName,
    workflowId: params.workflowId,
  });

  const created = await client.request(createItem("documents", doc as Document));

  return created as Document;
}

/**
 * Creates a document page record
 */
export async function createDocumentPage(params: {
  documentId: string;
  workflowStepId?: string;
  pageNumber: number;
  fileKey: string;
  text?: string;
  llmResult?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<DocumentPage> {
  const client = requireDirectus();
  const id = uuidv4();

  const page: Partial<DocumentPage> = {
    id,
    document: params.documentId,
    workflow_step: params.workflowStepId,
    page_number: params.pageNumber,
    file_key: params.fileKey,
    text: params.text,
    llm_result: params.llmResult,
    metadata: params.metadata || {},
  };

  logger.debug("[WorkflowService] Creating document page", {
    id,
    documentId: params.documentId,
    pageNumber: params.pageNumber,
  });

  const created = await client.request(createItem("document_pages", page as DocumentPage));

  return created as DocumentPage;
}

/**
 * Updates document page with LLM result
 */
export async function updateDocumentPageLlmResult(
  pageId: string,
  llmResult: Record<string, unknown>,
  text?: string
): Promise<DocumentPage> {
  const client = requireDirectus();

  const updates: Partial<DocumentPage> = {
    llm_result: llmResult,
  };

  if (text !== undefined) {
    updates.text = text;
  }

  logger.debug("[WorkflowService] Updating document page LLM result", {
    pageId,
  });

  const updated = await client.request(
    updateItem("document_pages", pageId, updates as DocumentPage)
  );

  return updated as DocumentPage;
}

// ============================================================================
// Workflow Listing Operations
// ============================================================================

/**
 * Gets recent workflows with optional filtering
 */
export async function getRecentWorkflows(params?: {
  state?: WorkflowState;
  type?: WorkflowType;
  limit?: number;
}): Promise<Workflow[]> {
  const client = requireDirectus();

  const filter: Record<string, unknown> = {};
  if (params?.state) filter.state = { _eq: params.state };
  if (params?.type) filter.type = { _eq: params.type };

  const workflows = await client.request(
    readItems("workflows", {
      filter,
      sort: ["-date_created"],
      limit: params?.limit || 50,
    })
  );

  return workflows as Workflow[];
}

/**
 * Gets failed ERP outbox entries for retry
 */
export async function getFailedErpOutboxEntries(limit?: number): Promise<ErpOutbox[]> {
  const client = requireDirectus();

  const entries = await client.request(
    readItems("erp_outbox", {
      filter: { state: { _eq: "failed" } },
      sort: ["-date_created"],
      limit: limit || 100,
    })
  );

  return entries as ErpOutbox[];
}

// Export singleton-like access
export const workflowService = {
  // Workflow
  createWorkflow,
  getWorkflow,
  getWorkflowWithSteps,
  updateWorkflowState,
  updateWorkflowProgress,
  setWorkflowError,

  // Steps
  createWorkflowStep,
  createPageSteps,
  getWorkflowStep,
  updateStepState,
  setStepError,
  getWorkflowSteps,
  countCompletedSteps,
  areAllStepsComplete,
  shouldWorkflowComplete,

  // ERP Outbox
  createErpOutboxEntry,
  getErpOutboxEntry,
  updateErpOutboxState,
  setErpOutboxError,
  markErpOutboxSent,

  // Documents
  createDocument,
  createDocumentPage,
  updateDocumentPageLlmResult,

  // Listing
  getRecentWorkflows,
  getFailedErpOutboxEntries,
};
