import { NativeConnection, Worker } from '@temporalio/worker';
import { config } from '../shared/config';
import { createWorkerLogger } from '../shared/logger';
import * as activities from '../activities';

const logger = createWorkerLogger('unified');

async function run() {
  try {
    const connection = await NativeConnection.connect({
      address: config.temporal.address,
    });

    const worker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: 'document-processing',
      workflowsPath: require.resolve('../workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10,
    });

    logger.info('Unified worker starting', {
      taskQueue: 'document-processing',
      namespace: config.temporal.namespace,
      address: config.temporal.address
    });

    await worker.run();
  } catch (error) {
    logger.error('Unified worker failed', error);
    process.exit(1);
  }
}

run().catch((err) => {
  logger.error('Failed to start unified worker', err);
  process.exit(1);
});

