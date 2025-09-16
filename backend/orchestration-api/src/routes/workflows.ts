import { Router } from 'express';
import { temporalClient } from '../temporal/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { documentProcessingWorkflow } from '../temporal/workflows';

const router = Router();

// Start a new workflow manually
router.post('/start', async (req, res) => {
  try {
    const { docId, source = 'upload', metadata = {} } = req.body;
    
    if (!docId) {
      return res.status(400).json({ error: 'Missing docId' });
    }

    const client = temporalClient.getClient();
    
    const workflowHandle = await client.workflow.start(documentProcessingWorkflow, {
      args: [{
        docId: String(docId),
        source,
        metadata
      }],
      taskQueue: config.temporal.taskQueue,
      workflowId: `document-${docId}-${Date.now()}`,
    });

    logger.info('Started workflow manually', { 
      docId, 
      source,
      workflowId: workflowHandle.workflowId 
    });

    res.json({
      success: true,
      workflowId: workflowHandle.workflowId,
      docId
    });

  } catch (error) {
    logger.error('Error starting workflow', error);
    res.status(500).json({ 
      error: 'Failed to start workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get workflow status
router.get('/:workflowId/status', async (req, res) => {
  try {
    const { workflowId } = req.params;
    
    const client = temporalClient.getClient();
    const workflowHandle = client.workflow.getHandle(workflowId);
    
    try {
      const status = await workflowHandle.query('workflowStatus');
      const currentStage = await workflowHandle.query('currentStage');
      const result = await workflowHandle.result();
      
      res.json({
        workflowId,
        status,
        currentStage,
        result
      });
      
    } catch (queryError) {
      // If workflow is not found or queries fail, try to get basic info
      const description = await workflowHandle.describe();
      
      res.json({
        workflowId,
        status: description.status.name,
        startTime: description.startTime,
        executionTime: description.executionTime,
        closeTime: description.closeTime
      });
    }

  } catch (error) {
    logger.error('Error getting workflow status', { workflowId: req.params.workflowId, error });
    res.status(404).json({ 
      error: 'Workflow not found',
      workflowId: req.params.workflowId
    });
  }
});

// Send signal to workflow
router.post('/:workflowId/signal/:signalName', async (req, res) => {
  try {
    const { workflowId, signalName } = req.params;
    const { args = [] } = req.body;
    
    const client = temporalClient.getClient();
    const workflowHandle = client.workflow.getHandle(workflowId);
    
    await workflowHandle.signal(signalName, ...args);
    
    logger.info('Sent signal to workflow', { workflowId, signalName, args });
    
    res.json({
      success: true,
      workflowId,
      signalName
    });

  } catch (error) {
    logger.error('Error sending signal to workflow', { 
      workflowId: req.params.workflowId, 
      signalName: req.params.signalName, 
      error 
    });
    res.status(500).json({ 
      error: 'Failed to send signal',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel workflow
router.post('/:workflowId/cancel', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { reason = 'Manual cancellation' } = req.body;
    
    const client = temporalClient.getClient();
    const workflowHandle = client.workflow.getHandle(workflowId);
    
    await workflowHandle.cancel();
    
    logger.info('Cancelled workflow', { workflowId, reason });
    
    res.json({
      success: true,
      workflowId,
      reason
    });

  } catch (error) {
    logger.error('Error cancelling workflow', { workflowId: req.params.workflowId, error });
    res.status(500).json({ 
      error: 'Failed to cancel workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List workflows
router.get('/', async (req, res) => {
  try {
    const client = temporalClient.getClient();
    
    const workflows = await client.workflow.list({
      query: 'WorkflowType="documentProcessingWorkflow"'
    });
    
    const workflowList = [];
    for await (const workflow of workflows) {
      workflowList.push({
        workflowId: workflow.workflowId,
        status: workflow.status.name,
        startTime: workflow.startTime,
        executionTime: workflow.executionTime,
        closeTime: workflow.closeTime
      });
    }
    
    res.json({
      workflows: workflowList,
      count: workflowList.length
    });

  } catch (error) {
    logger.error('Error listing workflows', error);
    res.status(500).json({ 
      error: 'Failed to list workflows',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as workflowRouter };


