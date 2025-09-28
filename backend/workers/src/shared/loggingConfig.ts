import { config } from './config';

/**
 * Logging configuration for different environments and components
 */
export const loggingConfig = {
  // Log levels by environment
  levels: {
    development: 'debug',
    staging: 'info',
    production: 'warn'
  } as Record<string, string>,

  // Component-specific log levels
  components: {
    'unified': config.nodeEnv === 'development' ? 'debug' : 'info',
    'file-processing': 'info',
    'directus-storage': 'info',
    'llm-validation': 'info',
    'classify': 'info',
    'activity-wrapper': config.nodeEnv === 'development' ? 'debug' : 'info'
  } as Record<string, string>,

  // Performance logging thresholds
  performance: {
    // Log slow operations (in milliseconds)
    slowOperationThreshold: 5000,
    // Log very slow operations (in milliseconds)
    verySlowOperationThreshold: 15000,
    // Log memory usage when heap exceeds this (in MB)
    memoryThreshold: 500,
    // Log when heap delta exceeds this (in MB)
    memoryDeltaThreshold: 100
  },

  // Activity-specific logging configuration
  activities: {
    // Log input/output for these activities in development
    logInputOutput: config.nodeEnv === 'development' ? [
      'uploadFileToStorage',
      'validateWasteDocument',
      'classifyDocument'
    ] : [],
    
    // Always log these critical activities
    alwaysLog: [
      'storeDocument',
      'updateDocumentStatus',
      'createExtractionJob'
    ],
    
    // Sensitive activities that should have minimal logging in production
    sensitiveActivities: [
      'validateWasteDocument', // May contain sensitive document data
      'extractWithLLM'         // May contain API keys in errors
    ]
  },

  // External service logging
  externalServices: {
    // Log all calls to these services
    logAllCalls: [
      'MinIO',
      'Directus',
      'OpenAI',
      'Gemini'
    ],
    
    // Log only errors for these services
    logErrorsOnly: [],
    
    // Timeout thresholds for external service calls (in milliseconds)
    timeouts: {
      'MinIO': 30000,
      'Directus': 10000,
      'OpenAI': 60000,
      'Gemini': 60000
    } as Record<string, number>
  },

  // Error handling configuration
  errors: {
    // Include stack traces in these environments
    includeStackTrace: ['development', 'staging'],
    
    // Log error context (input data, etc.) in these environments
    includeContext: ['development'],
    
    // Sanitize error messages in production
    sanitizeInProduction: true,
    
    // Maximum error message length
    maxErrorMessageLength: 1000
  },

  // File and console output configuration
  output: {
    // Use JSON format in production
    useJsonFormat: config.nodeEnv === 'production',
    
    // Include colors in development
    useColors: config.nodeEnv === 'development',
    
    // Maximum log message length before truncation
    maxMessageLength: 5000,
    
    // Include metadata in logs
    includeMetadata: true,
    
    // Timestamp format
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
  }
};

/**
 * Get log level for a specific component
 */
export function getLogLevel(component: string): string {
  return loggingConfig.components[component] || 
         loggingConfig.levels[config.nodeEnv] || 
         'info';
}

/**
 * Check if input/output should be logged for an activity
 */
export function shouldLogInputOutput(activityName: string): boolean {
  return loggingConfig.activities.logInputOutput.includes(activityName) ||
         loggingConfig.activities.alwaysLog.includes(activityName);
}

/**
 * Check if an activity is sensitive and should have minimal logging
 */
export function isSensitiveActivity(activityName: string): boolean {
  return loggingConfig.activities.sensitiveActivities.includes(activityName) &&
         config.nodeEnv === 'production';
}

/**
 * Check if external service calls should be logged
 */
export function shouldLogExternalCall(serviceName: string, isError: boolean = false): boolean {
  return (loggingConfig.externalServices.logAllCalls as string[]).includes(serviceName) ||
         (isError && !(loggingConfig.externalServices.logErrorsOnly as string[]).includes(serviceName));
}

/**
 * Check if operation is considered slow
 */
export function isSlowOperation(duration: number): 'fast' | 'normal' | 'slow' | 'very-slow' {
  if (duration >= loggingConfig.performance.verySlowOperationThreshold) {
    return 'very-slow';
  } else if (duration >= loggingConfig.performance.slowOperationThreshold) {
    return 'slow';
  } else if (duration >= 1000) {
    return 'normal';
  } else {
    return 'fast';
  }
}

/**
 * Check if memory usage should be logged
 */
export function shouldLogMemoryUsage(heapUsedMB: number, heapDeltaMB?: number): boolean {
  return heapUsedMB >= loggingConfig.performance.memoryThreshold ||
         (heapDeltaMB !== undefined && heapDeltaMB >= loggingConfig.performance.memoryDeltaThreshold);
}

/**
 * Sanitize error message for production
 */
export function sanitizeErrorMessage(message: string): string {
  if (!loggingConfig.errors.sanitizeInProduction || config.nodeEnv !== 'production') {
    return message;
  }

  // Remove potential sensitive information
  let sanitized = message
    .replace(/api[_-]?key[s]?[:\s=]+[^\s]+/gi, 'api_key=[REDACTED]')
    .replace(/token[s]?[:\s=]+[^\s]+/gi, 'token=[REDACTED]')
    .replace(/password[s]?[:\s=]+[^\s]+/gi, 'password=[REDACTED]')
    .replace(/secret[s]?[:\s=]+[^\s]+/gi, 'secret=[REDACTED]');

  // Truncate if too long
  if (sanitized.length > loggingConfig.errors.maxErrorMessageLength) {
    sanitized = sanitized.substring(0, loggingConfig.errors.maxErrorMessageLength) + '...[truncated]';
  }

  return sanitized;
}

/**
 * Get timeout for external service
 */
export function getServiceTimeout(serviceName: string): number {
  return loggingConfig.externalServices.timeouts[serviceName] || 30000;
}
