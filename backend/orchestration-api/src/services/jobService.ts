import { logger } from '../utils/logger';
import { ValidationResult } from './llmService';

export interface JobData {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  fileName?: string;
  fileSize?: number;
  provider?: 'openai' | 'gemini';
  validationResult?: ValidationResult;
  excelBuffer?: Buffer;
  excelFilename?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job store (in production, this should be replaced with a database)
const jobStore = new Map<string, JobData>();

export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function createJob(jobId: string, fileName?: string, fileSize?: number): JobData {
  const job: JobData = {
    jobId,
    status: 'processing',
    fileName,
    fileSize,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  jobStore.set(jobId, job);
  logger.info('Job created', { jobId, fileName, fileSize });
  
  return job;
}

export function updateJob(jobId: string, updates: Partial<JobData>): JobData | null {
  const job = jobStore.get(jobId);
  if (!job) {
    logger.warn('Job not found for update', { jobId });
    return null;
  }
  
  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date()
  };
  
  jobStore.set(jobId, updatedJob);
  logger.info('Job updated', { jobId, updates: Object.keys(updates) });
  
  return updatedJob;
}

export function getJob(jobId: string): JobData | null {
  const job = jobStore.get(jobId);
  if (!job) {
    logger.warn('Job not found', { jobId });
    return null;
  }
  
  return job;
}

export function completeJob(jobId: string, validationResult: ValidationResult, provider: 'openai' | 'gemini'): JobData | null {
  const updates: Partial<JobData> = {
    status: 'completed',
    validationResult,
    provider
  };
  
  return updateJob(jobId, updates);
}

export function failJob(jobId: string, error: string): JobData | null {
  const updates: Partial<JobData> = {
    status: 'failed',
    error
  };
  
  return updateJob(jobId, updates);
}

export function setJobExcel(jobId: string, excelBuffer: Buffer, excelFilename: string): JobData | null {
  const updates: Partial<JobData> = {
    excelBuffer,
    excelFilename
  };
  
  return updateJob(jobId, updates);
}

export function getAllJobs(): JobData[] {
  return Array.from(jobStore.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function cleanupOldJobs(maxAgeHours: number = 24): number {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  let cleanedCount = 0;
  
  for (const [jobId, job] of jobStore.entries()) {
    if (job.createdAt < cutoffTime) {
      jobStore.delete(jobId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info('Cleaned up old jobs', { cleanedCount, maxAgeHours });
  }
  
  return cleanedCount;
}

// Auto-cleanup old jobs every hour
setInterval(() => {
  cleanupOldJobs();
}, 60 * 60 * 1000);
