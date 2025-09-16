import { proxyActivities, defineSignal, defineQuery, setHandler, condition, log } from '@temporalio/workflow';
import type * as activities from './activities';

// Proxy activities with proper timeouts
// All activities now run on the same task queue handled by unified worker
const {
  classifyDocument,
  parsePdfOrOcr,
  extractWithLLM,
  validateAndEnrich,
  exportCsv,
  deliverToTarget,
  sendNotification
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '30 seconds',
  retryPolicy: {
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Signals for human-in-the-loop workflow
export const reviewApprovedSignal = defineSignal<[{ docId: string; patch?: any }]>('reviewApproved');
export const workflowCancelledSignal = defineSignal('workflowCancelled');

// Queries for workflow state
export const workflowStatusQuery = defineQuery<string>('workflowStatus');
export const currentStageQuery = defineQuery<string>('currentStage');

export interface DocumentWorkflowInput {
  docId: string;
  source: 'upload' | 'email';
  metadata?: {
    originalFilename?: string;
    emailSender?: string;
    uploadedBy?: string;
  };
}

export interface DocumentWorkflowResult {
  docId: string;
  status: 'completed' | 'failed' | 'cancelled';
  stages: {
    classify: { status: string; result?: any; error?: string };
    parse: { status: string; result?: any; error?: string };
    extract: { status: string; result?: any; error?: string };
    validate: { status: string; result?: any; error?: string };
    review: { status: string; result?: any; error?: string };
    export: { status: string; result?: any; error?: string };
    deliver: { status: string; result?: any; error?: string };
  };
}

export async function documentProcessingWorkflow(
  input: DocumentWorkflowInput
): Promise<DocumentWorkflowResult> {
  let currentStage = 'initialized';
  let workflowStatus = 'running';
  let cancelled = false;
  let reviewData: any = null;

  const result: DocumentWorkflowResult = {
    docId: input.docId,
    status: 'completed',
    stages: {
      classify: { status: 'pending' },
      parse: { status: 'pending' },
      extract: { status: 'pending' },
      validate: { status: 'pending' },
      review: { status: 'pending' },
      export: { status: 'pending' },
      deliver: { status: 'pending' }
    }
  };

  // Set up signal and query handlers
  setHandler(reviewApprovedSignal, ({ docId, patch }) => {
    if (docId === input.docId) {
      reviewData = { approved: true, patch };
    }
  });

  setHandler(workflowCancelledSignal, () => {
    cancelled = true;
    workflowStatus = 'cancelled';
  });

  setHandler(workflowStatusQuery, () => workflowStatus);
  setHandler(currentStageQuery, () => currentStage);

  try {
    log.info('Starting document processing workflow', { docId: input.docId, source: input.source });

    // Stage 1: Classify Document
    currentStage = 'classify';
    result.stages.classify.status = 'running';
    
    if (cancelled) throw new Error('Workflow cancelled');
    
    try {
      const classifyResult = await classifyDocument({ docId: input.docId });
      result.stages.classify.status = 'completed';
      result.stages.classify.result = classifyResult;
      log.info('Document classification completed', { docId: input.docId, type: classifyResult.docType });
    } catch (error) {
      result.stages.classify.status = 'failed';
      result.stages.classify.error = String(error);
      throw error;
    }

    // Stage 2: Parse PDF or OCR
    currentStage = 'parse';
    result.stages.parse.status = 'running';
    
    if (cancelled) throw new Error('Workflow cancelled');
    
    try {
      const parseResult = await parsePdfOrOcr({ docId: input.docId });
      result.stages.parse.status = 'completed';
      result.stages.parse.result = parseResult;
      log.info('Document parsing completed', { docId: input.docId, pages: parseResult.pages });
    } catch (error) {
      result.stages.parse.status = 'failed';
      result.stages.parse.error = String(error);
      throw error;
    }

    // Stage 3: Extract with LLM
    currentStage = 'extract';
    result.stages.extract.status = 'running';
    
    if (cancelled) throw new Error('Workflow cancelled');
    
    try {
      const extractResult = await extractWithLLM({ docId: input.docId });
      result.stages.extract.status = 'completed';
      result.stages.extract.result = extractResult;
      log.info('LLM extraction completed', { docId: input.docId, fieldsExtracted: Object.keys(extractResult.fields).length });
    } catch (error) {
      result.stages.extract.status = 'failed';
      result.stages.extract.error = String(error);
      throw error;
    }

    // Stage 4: Validate and Enrich
    currentStage = 'validate';
    result.stages.validate.status = 'running';
    
    if (cancelled) throw new Error('Workflow cancelled');
    
    try {
      const validateResult = await validateAndEnrich({ docId: input.docId });
      result.stages.validate.status = 'completed';
      result.stages.validate.result = validateResult;
      
      // Send notification if review is needed
      if (validateResult.needsReview) {
        await sendNotification({
          type: 'needs_review',
          docId: input.docId,
          message: 'Document requires human review'
        });
      }
      
      log.info('Validation completed', { docId: input.docId, needsReview: validateResult.needsReview });
    } catch (error) {
      result.stages.validate.status = 'failed';
      result.stages.validate.error = String(error);
      throw error;
    }

    // Stage 5: Wait for Human Review (if needed)
    currentStage = 'review';
    result.stages.review.status = 'running';
    
    if (result.stages.validate.result?.needsReview) {
      log.info('Waiting for human review', { docId: input.docId });
      
      // Wait for review approval signal or cancellation
      await condition(() => reviewData !== null || cancelled);
      
      if (cancelled) throw new Error('Workflow cancelled');
      
      if (reviewData && reviewData.approved) {
        result.stages.review.status = 'completed';
        result.stages.review.result = reviewData;
        log.info('Human review approved', { docId: input.docId });
      } else {
        throw new Error('Review not approved or invalid review data');
      }
    } else {
      result.stages.review.status = 'skipped';
      log.info('Review not required', { docId: input.docId });
    }

    // Stage 6: Export CSV
    currentStage = 'export';
    result.stages.export.status = 'running';
    
    if (cancelled) throw new Error('Workflow cancelled');
    
    try {
      const exportResult = await exportCsv({ 
        docId: input.docId,
        patch: reviewData?.patch 
      });
      result.stages.export.status = 'completed';
      result.stages.export.result = exportResult;
      log.info('CSV export completed', { docId: input.docId, filename: exportResult.filename });
    } catch (error) {
      result.stages.export.status = 'failed';
      result.stages.export.error = String(error);
      throw error;
    }

    // Stage 7: Deliver to Target Systems
    currentStage = 'deliver';
    result.stages.deliver.status = 'running';
    
    if (cancelled) throw new Error('Workflow cancelled');
    
    try {
      const deliverResult = await deliverToTarget({ 
        docId: input.docId,
        exportPath: result.stages.export.result?.path 
      });
      result.stages.deliver.status = 'completed';
      result.stages.deliver.result = deliverResult;
      
      // Send completion notification
      await sendNotification({
        type: 'delivered',
        docId: input.docId,
        message: 'Document processing completed and delivered'
      });
      
      log.info('Document delivery completed', { docId: input.docId, targets: deliverResult.targets });
    } catch (error) {
      result.stages.deliver.status = 'failed';
      result.stages.deliver.error = String(error);
      throw error;
    }

    workflowStatus = 'completed';
    log.info('Document processing workflow completed successfully', { docId: input.docId });
    return result;

  } catch (error) {
    workflowStatus = cancelled ? 'cancelled' : 'failed';
    result.status = workflowStatus as any;
    
    log.error('Document processing workflow failed', { 
      docId: input.docId, 
      error: String(error), 
      currentStage 
    });
    
    // Send failure notification
    await sendNotification({
      type: 'failed',
      docId: input.docId,
      message: `Document processing failed at stage: ${currentStage}`,
      error: String(error)
    });
    
    throw error;
  }
}


