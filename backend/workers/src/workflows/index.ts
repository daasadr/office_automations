// Re-export workflows from the orchestration API
// This ensures the worker can find the workflow definitions
export * from '../../../orchestration-api/src/temporal/workflows';

// Export our new file processing workflows
export * from './fileProcessing';
