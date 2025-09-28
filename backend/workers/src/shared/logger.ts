import winston from 'winston';
import { config } from './config';

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, worker, activity, jobId, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  const context = [worker, activity, jobId].filter(Boolean).join(':');
  const contextStr = context ? `[${context}] ` : '';
  
  return `${timestamp} ${level}: ${contextStr}${message}${metaStr ? '\n' + metaStr : ''}`;
});

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  config.nodeEnv === 'production' ? winston.format.json() : customFormat
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format,
  defaultMeta: { 
    service: 'temporal-worker',
    nodeEnv: config.nodeEnv,
    pid: process.pid
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
      format: config.nodeEnv === 'production' 
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            customFormat
          )
    })
  ],
  exitOnError: false
});

// Performance tracking interface
export interface PerformanceTracker {
  start: number;
  end?: number;
  duration?: number;
  memory?: NodeJS.MemoryUsage;
}

export function createWorkerLogger(workerName: string) {
  const workerLogger = logger.child({ worker: workerName });
  
  return {
    ...workerLogger,
    
    // Activity-specific logger
    activity: (activityName: string, jobId?: string) => {
      return workerLogger.child({ 
        activity: activityName,
        ...(jobId && { jobId })
      });
    },
    
    // Performance tracking
    startTimer: (operation: string, metadata?: any): PerformanceTracker => {
      const tracker: PerformanceTracker = {
        start: Date.now(),
        memory: process.memoryUsage()
      };
      
      workerLogger.debug(`Starting ${operation}`, {
        operation,
        startTime: new Date(tracker.start).toISOString(),
        memoryUsage: tracker.memory,
        ...metadata
      });
      
      return tracker;
    },
    
    endTimer: (operation: string, tracker: PerformanceTracker, metadata?: any) => {
      tracker.end = Date.now();
      tracker.duration = tracker.end - tracker.start;
      const endMemory = process.memoryUsage();
      
      workerLogger.info(`Completed ${operation}`, {
        operation,
        duration: `${tracker.duration}ms`,
        startTime: new Date(tracker.start).toISOString(),
        endTime: new Date(tracker.end).toISOString(),
        memoryUsage: {
          start: tracker.memory,
          end: endMemory,
          heapDelta: endMemory.heapUsed - (tracker.memory?.heapUsed || 0)
        },
        ...metadata
      });
      
      return tracker;
    },
    
    // Error with context
    errorWithContext: (message: string, error: Error, context?: any) => {
      workerLogger.error(message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        },
        context,
        timestamp: new Date().toISOString()
      });
    },
    
    // Structured activity logging
    activityStart: (activityName: string, input: any, jobId?: string) => {
      const activityLogger = workerLogger.child({ 
        activity: activityName,
        ...(jobId && { jobId })
      });
      
      activityLogger.info(`Activity started: ${activityName}`, {
        input: typeof input === 'object' ? JSON.stringify(input) : input,
        inputSize: JSON.stringify(input).length,
        startTime: new Date().toISOString()
      });
      
      return activityLogger;
    },
    
    activityEnd: (activityName: string, result: any, duration: number, jobId?: string) => {
      const activityLogger = workerLogger.child({ 
        activity: activityName,
        ...(jobId && { jobId })
      });
      
      activityLogger.info(`Activity completed: ${activityName}`, {
        success: true,
        duration: `${duration}ms`,
        resultSize: JSON.stringify(result).length,
        endTime: new Date().toISOString()
      });
    },
    
    activityError: (activityName: string, error: Error, duration: number, jobId?: string) => {
      const activityLogger = workerLogger.child({ 
        activity: activityName,
        ...(jobId && { jobId })
      });
      
      activityLogger.error(`Activity failed: ${activityName}`, {
        success: false,
        duration: `${duration}ms`,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        endTime: new Date().toISOString()
      });
    }
  };
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason,
    promise: promise.toString(),
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

// Export types
export type WorkerLogger = ReturnType<typeof createWorkerLogger>;


