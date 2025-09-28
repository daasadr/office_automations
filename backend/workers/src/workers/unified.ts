import { NativeConnection, Worker } from '@temporalio/worker';
import { config } from '../shared/config';
import { createWorkerLogger } from '../shared/logger';
import * as activities from '../activities';

const logger = createWorkerLogger('unified');

// Worker health monitoring
let workerHealth = {
  status: 'initializing',
  startTime: new Date(),
  lastActivity: new Date(),
  activitiesProcessed: 0,
  errors: 0,
  memoryUsage: process.memoryUsage()
};

// Update health metrics
function updateHealth(status: string, error?: boolean) {
  workerHealth.status = status;
  workerHealth.lastActivity = new Date();
  if (error) {
    workerHealth.errors++;
  } else {
    workerHealth.activitiesProcessed++;
  }
  workerHealth.memoryUsage = process.memoryUsage();
}

// Log health metrics periodically
function startHealthMonitoring() {
  setInterval(() => {
    const uptime = Date.now() - workerHealth.startTime.getTime();
    const memUsageMB = {
      rss: Math.round(workerHealth.memoryUsage.rss / 1024 / 1024),
      heapUsed: Math.round(workerHealth.memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(workerHealth.memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(workerHealth.memoryUsage.external / 1024 / 1024)
    };

    logger.info('Worker health status', {
      status: workerHealth.status,
      uptime: `${Math.round(uptime / 1000)}s`,
      activitiesProcessed: workerHealth.activitiesProcessed,
      errors: workerHealth.errors,
      errorRate: workerHealth.activitiesProcessed > 0 
        ? `${((workerHealth.errors / workerHealth.activitiesProcessed) * 100).toFixed(2)}%` 
        : '0%',
      memoryUsage: memUsageMB,
      lastActivity: workerHealth.lastActivity.toISOString()
    });
  }, 60000); // Log every minute
}

async function run() {
  const startupTimer = logger.startTimer('worker-startup');
  
  try {
    logger.info('Initializing unified worker', {
      nodeEnv: config.nodeEnv,
      logLevel: config.logLevel,
      pid: process.pid,
      temporalConfig: {
        address: config.temporal.address,
        namespace: config.temporal.namespace,
        taskQueue: config.temporal.taskQueue
      }
    });

    // Connect to Temporal
    logger.debug('Connecting to Temporal server');
    const connection = await NativeConnection.connect({
      address: config.temporal.address,
    });
    logger.info('Connected to Temporal server', { address: config.temporal.address });

    // Create worker
    logger.debug('Creating Temporal worker');
    const worker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: 'document-processing',
      workflowsPath: require.resolve('../workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10,
    });

    logger.endTimer('worker-startup', startupTimer, {
      taskQueue: 'document-processing',
      namespace: config.temporal.namespace,
      maxConcurrentActivities: 10
    });

    updateHealth('running');
    startHealthMonitoring();

    logger.info('Unified worker started successfully', {
      taskQueue: 'document-processing',
      namespace: config.temporal.namespace,
      address: config.temporal.address,
      maxConcurrentActivities: 10,
      availableActivities: Object.keys(activities).length,
      activities: Object.keys(activities)
    });

    // Worker event handlers would go here if available
    // Note: Temporal Worker doesn't expose error events in this version

    // Start processing
    logger.info('Worker is now listening for activities...');
    await worker.run();
    
  } catch (error) {
    updateHealth('failed', true);
    logger.errorWithContext('Unified worker failed to start', error as Error, {
      config: {
        temporal: config.temporal,
        nodeEnv: config.nodeEnv
      },
      workerHealth
    });
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  updateHealth('shutting-down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  updateHealth('shutting-down');
  process.exit(0);
});

run().catch((err) => {
  updateHealth('startup-failed', true);
  logger.errorWithContext('Failed to start unified worker', err, {
    config: {
      temporal: config.temporal,
      nodeEnv: config.nodeEnv
    }
  });
  process.exit(1);
});

