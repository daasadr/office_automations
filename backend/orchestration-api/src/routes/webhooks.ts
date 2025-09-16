import { Router } from 'express';
import { temporalClient } from '../temporal/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { documentProcessingWorkflow } from '../temporal/workflows';
import { validateWebhookSignature } from '../middleware/validateWebhook';

const router = Router();

// Webhook endpoint for Directus document.created event
router.post('/directus/document-created', validateWebhookSignature, async (req, res) => {
  try {
    const { payload } = req.body;
    const docId = payload?.key || payload?.id;
    
    if (!docId) {
      return res.status(400).json({ error: 'Missing document ID in payload' });
    }

    logger.info('Received document.created webhook', { docId, payload });

    const client = temporalClient.getClient();
    
    // Start the document processing workflow
    const workflowHandle = await client.workflow.start(documentProcessingWorkflow, {
      args: [{
        docId: String(docId),
        source: 'upload',
        metadata: {
          originalFilename: payload?.filename_download,
          uploadedBy: payload?.uploaded_by
        }
      }],
      taskQueue: config.temporal.taskQueue,
      workflowId: `document-${docId}-${Date.now()}`,
    });

    logger.info('Started document processing workflow', { 
      docId, 
      workflowId: workflowHandle.workflowId 
    });

    res.json({
      success: true,
      workflowId: workflowHandle.workflowId,
      docId
    });

  } catch (error) {
    logger.error('Error processing document.created webhook', error);
    res.status(500).json({ 
      error: 'Failed to start document processing workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Webhook endpoint for review approval
router.post('/directus/review-approved', validateWebhookSignature, async (req, res) => {
  try {
    const { payload } = req.body;
    const docId = payload?.key || payload?.id;
    const patch = payload?.patch;
    
    if (!docId) {
      return res.status(400).json({ error: 'Missing document ID in payload' });
    }

    logger.info('Received review approval webhook', { docId, patch });

    const client = temporalClient.getClient();
    
    // Find the workflow for this document
    const workflowId = `document-${docId}`;
    
    try {
      const workflowHandle = client.workflow.getHandle(workflowId);
      
      // Send the review approved signal
      await workflowHandle.signal('reviewApproved', { docId, patch });
      
      logger.info('Sent review approved signal', { docId, workflowId });
      
      res.json({
        success: true,
        workflowId,
        docId
      });
      
    } catch (workflowError) {
      logger.error('Failed to find or signal workflow', { docId, workflowId, error: workflowError });
      res.status(404).json({ 
        error: 'Workflow not found for document',
        docId,
        workflowId
      });
    }

  } catch (error) {
    logger.error('Error processing review approval webhook', error);
    res.status(500).json({ 
      error: 'Failed to process review approval',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as webhookRouter };


