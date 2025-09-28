import { createWorkerLogger, WorkerLogger } from './logger';

const logger = createWorkerLogger('activity-wrapper');

// Activity execution context
interface ActivityContext {
  activityName: string;
  jobId?: string;
  input: any;
  startTime: number;
  logger: any;
}

// Activity result wrapper
interface ActivityResult<T = any> {
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  metadata?: any;
}

/**
 * Wraps an activity function with comprehensive logging
 */
export function withActivityLogging<TInput, TResult>(
  activityName: string,
  activityFn: (input: TInput) => Promise<TResult>
) {
  return async (input: TInput): Promise<TResult> => {
    const startTime = Date.now();
    const jobId = extractJobId(input);
    const activityLogger = logger.activity(activityName, jobId);
    
    const context: ActivityContext = {
      activityName,
      jobId,
      input,
      startTime,
      logger: activityLogger
    };

    // Log activity start
    activityLogger.info(`🚀 Activity started`, {
      activityName,
      jobId,
      inputType: typeof input,
      inputSize: getInputSize(input),
      timestamp: new Date().toISOString()
    });

    // Log input details (sanitized)
    activityLogger.debug('Activity input details', {
      input: sanitizeInput(input),
      inputKeys: typeof input === 'object' && input ? Object.keys(input) : undefined
    });

    try {
      // Execute the activity
      const result = await activityFn(input);
      const duration = Date.now() - startTime;

      // Log successful completion
      activityLogger.info(`✅ Activity completed successfully`, {
        activityName,
        jobId,
        duration: `${duration}ms`,
        resultType: typeof result,
        resultSize: getResultSize(result),
        timestamp: new Date().toISOString()
      });

      // Log result details (sanitized)
      activityLogger.debug('Activity result details', {
        result: sanitizeResult(result),
        resultKeys: typeof result === 'object' && result ? Object.keys(result) : undefined
      });

      // Log performance metrics
      logPerformanceMetrics(activityLogger, context, duration, true);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      // Log error
      activityLogger.error(`❌ Activity failed`, {
        activityName,
        jobId,
        duration: `${duration}ms`,
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack,
          cause: err.cause
        },
        timestamp: new Date().toISOString()
      });

      // Log performance metrics for failed activity
      logPerformanceMetrics(activityLogger, context, duration, false);

      throw error;
    }
  };
}

/**
 * Extract job ID from various input formats
 */
function extractJobId(input: any): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  
  return input.jobId || 
         input.id || 
         input.documentId || 
         input.docId || 
         input.workflowId ||
         undefined;
}

/**
 * Get input size for logging
 */
function getInputSize(input: any): string {
  try {
    if (input && typeof input === 'object' && input.fileBuffer) {
      return `${Math.round(input.fileBuffer.length / 1024)}KB buffer + ${JSON.stringify({...input, fileBuffer: '[Buffer]'}).length}B metadata`;
    }
    return `${JSON.stringify(input).length}B`;
  } catch {
    return 'unknown';
  }
}

/**
 * Get result size for logging
 */
function getResultSize(result: any): string {
  try {
    if (result && typeof result === 'object' && result.processedImages) {
      const imagesSize = Array.isArray(result.processedImages) 
        ? result.processedImages.reduce((sum: number, img: any) => sum + (typeof img === 'string' ? img.length : 0), 0)
        : 0;
      return `${Math.round(imagesSize / 1024)}KB images + ${JSON.stringify({...result, processedImages: '[Images]'}).length}B metadata`;
    }
    return `${JSON.stringify(result).length}B`;
  } catch {
    return 'unknown';
  }
}

/**
 * Sanitize input for logging (remove sensitive data, truncate large values)
 */
function sanitizeInput(input: any): any {
  if (!input || typeof input !== 'object') return input;

  const sanitized = { ...input };
  
  // Remove or truncate large buffers
  if (sanitized.fileBuffer) {
    sanitized.fileBuffer = `[Buffer: ${sanitized.fileBuffer.length} bytes]`;
  }
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'apiKey'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  // Truncate long strings
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
      sanitized[key] = sanitized[key].substring(0, 1000) + '...[truncated]';
    }
  });

  return sanitized;
}

/**
 * Sanitize result for logging
 */
function sanitizeResult(result: any): any {
  if (!result || typeof result !== 'object') return result;

  const sanitized = { ...result };
  
  // Truncate large arrays
  if (Array.isArray(sanitized.processedImages)) {
    sanitized.processedImages = `[${sanitized.processedImages.length} images]`;
  }
  
  if (Array.isArray(sanitized.extractedData)) {
    sanitized.extractedData = `[${sanitized.extractedData.length} items]`;
  }

  // Truncate long strings
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
      sanitized[key] = sanitized[key].substring(0, 500) + '...[truncated]';
    }
  });

  return sanitized;
}

/**
 * Log performance metrics
 */
function logPerformanceMetrics(
  activityLogger: any, 
  context: ActivityContext, 
  duration: number, 
  success: boolean
) {
  const memoryUsage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };

  activityLogger.info(`📊 Activity performance metrics`, {
    activityName: context.activityName,
    jobId: context.jobId,
    success,
    duration: `${duration}ms`,
    memoryUsage: memoryMB,
    performanceCategory: getPerformanceCategory(duration),
    timestamp: new Date().toISOString()
  });
}

/**
 * Categorize performance based on duration
 */
function getPerformanceCategory(duration: number): string {
  if (duration < 1000) return 'fast';
  if (duration < 5000) return 'normal';
  if (duration < 15000) return 'slow';
  return 'very-slow';
}

/**
 * Create activity-specific logger with context
 */
export function createActivityLogger(activityName: string, jobId?: string) {
  return logger.activity(activityName, jobId);
}

/**
 * Log activity step within an activity
 */
export function logActivityStep(
  activityLogger: any,
  stepName: string,
  stepData?: any
) {
  activityLogger.debug(`🔄 Activity step: ${stepName}`, {
    step: stepName,
    stepData: stepData ? sanitizeInput(stepData) : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log external service call
 */
export function logExternalCall(
  activityLogger: any,
  serviceName: string,
  operation: string,
  duration?: number,
  success?: boolean,
  metadata?: any
) {
  const logLevel = success === false ? 'warn' : 'info';
  const icon = success === false ? '⚠️' : '🌐';
  
  activityLogger[logLevel](`${icon} External service call`, {
    service: serviceName,
    operation,
    duration: duration ? `${duration}ms` : undefined,
    success,
    metadata: metadata ? sanitizeInput(metadata) : undefined,
    timestamp: new Date().toISOString()
  });
}
