import winston from 'winston';
import { config } from './config';

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format,
  defaultMeta: { service: 'temporal-worker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export function createWorkerLogger(workerName: string) {
  return logger.child({ worker: workerName });
}


