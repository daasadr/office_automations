import { Client, Connection } from '@temporalio/client';
import { config } from '../config';
import { logger } from '../utils/logger';

class TemporalClient {
  private client: Client | null = null;
  private connection: Connection | null = null;

  async connect(): Promise<void> {
    try {
      this.connection = await Connection.connect({
        address: config.temporal.address,
      });

      this.client = new Client({
        connection: this.connection,
        namespace: config.temporal.namespace,
      });

      logger.info('Successfully connected to Temporal server', {
        address: config.temporal.address,
        namespace: config.temporal.namespace
      });
    } catch (error) {
      logger.error('Failed to connect to Temporal server', error);
      throw error;
    }
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Temporal client not initialized. Call connect() first.');
    }
    return this.client;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.client = null;
      logger.info('Temporal connection closed');
    }
  }
}

export const temporalClient = new TemporalClient();


