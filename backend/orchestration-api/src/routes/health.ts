import { Router } from 'express';
import { temporalClient } from '../temporal/client';

const router = Router();

router.get('/', async (req, res) => {
  try {
    // Check Temporal connection
    const client = temporalClient.getClient();
    
    // Try to list workflows to verify connection
    await client.workflow.list();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        temporal: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        temporal: 'disconnected',
        api: 'running'
      }
    });
  }
});

export { router as healthRouter };


