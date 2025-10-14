import { logger } from "../utils/logger";
import type { ValidationResult } from "./llm";

export interface JobData {
  jobId: string;
  status: "processing" | "completed" | "failed";
  fileName?: string;
  fileSize?: number;
  provider?: "gemini";
  validationResult?: ValidationResult;
  excelBuffer?: Buffer;
  excelFilename?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  // Directus IDs for tracking
  directusSourceDocumentId?: string;
  directusResponseId?: string;
  directusGeneratedDocumentId?: string;
}

// Configuration for job cleanup
interface JobCleanupConfig {
  maxAgeHours: number;
  intervalHours: number;
  enabled: boolean;
}

const cleanupConfig: JobCleanupConfig = {
  maxAgeHours: parseInt(process.env.JOB_CLEANUP_MAX_AGE_HOURS || "24", 10),
  intervalHours: parseInt(process.env.JOB_CLEANUP_INTERVAL_HOURS || "1", 10),
  enabled: process.env.JOB_CLEANUP_ENABLED !== "false",
};

// In-memory job store (in production, this should be replaced with a database)
const jobStore = new Map<string, JobData>();

// Auto-cleanup timer reference
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Generates a unique job ID
 */
export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Creates a new job
 */
export function createJob(jobId: string, fileName?: string, fileSize?: number): JobData {
  const job: JobData = {
    jobId,
    status: "processing",
    fileName,
    fileSize,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobStore.set(jobId, job);
  logger.info("Job created", { jobId, fileName, fileSize });

  return job;
}

/**
 * Updates an existing job
 */
export function updateJob(jobId: string, updates: Partial<JobData>): JobData | null {
  const job = jobStore.get(jobId);
  if (!job) {
    logger.warn("Job not found for update", { jobId });
    return null;
  }

  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date(),
  };

  jobStore.set(jobId, updatedJob);
  logger.info("Job updated", { jobId, updates: Object.keys(updates) });

  return updatedJob;
}

/**
 * Retrieves a job by ID
 */
export function getJob(jobId: string): JobData | null {
  const job = jobStore.get(jobId);
  if (!job) {
    logger.warn("Job not found", { jobId });
    return null;
  }

  return job;
}

/**
 * Marks a job as completed
 */
export function completeJob(
  jobId: string,
  validationResult: ValidationResult,
  provider: "gemini"
): JobData | null {
  const updates: Partial<JobData> = {
    status: "completed",
    validationResult,
    provider,
  };

  return updateJob(jobId, updates);
}

/**
 * Marks a job as failed
 */
export function failJob(jobId: string, error: string): JobData | null {
  const updates: Partial<JobData> = {
    status: "failed",
    error,
  };

  return updateJob(jobId, updates);
}

/**
 * Sets Excel data for a job
 */
export function setJobExcel(
  jobId: string,
  excelBuffer: Buffer,
  excelFilename: string
): JobData | null {
  const updates: Partial<JobData> = {
    excelBuffer,
    excelFilename,
  };

  return updateJob(jobId, updates);
}

/**
 * Gets all jobs sorted by creation date
 */
export function getAllJobs(): JobData[] {
  return Array.from(jobStore.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Cleans up old jobs based on age
 */
export function cleanupOldJobs(maxAgeHours: number = cleanupConfig.maxAgeHours): number {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  let cleanedCount = 0;

  for (const [jobId, job] of jobStore.entries()) {
    if (job.createdAt < cutoffTime) {
      jobStore.delete(jobId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info("Cleaned up old jobs", { cleanedCount, maxAgeHours });
  }

  return cleanedCount;
}

/**
 * Starts the auto-cleanup timer
 */
export function startAutoCleanup(): void {
  if (!cleanupConfig.enabled) {
    logger.info("Job auto-cleanup is disabled");
    return;
  }

  if (cleanupTimer) {
    logger.warn("Auto-cleanup timer is already running");
    return;
  }

  const intervalMs = cleanupConfig.intervalHours * 60 * 60 * 1000;

  cleanupTimer = setInterval(() => {
    cleanupOldJobs();
  }, intervalMs);

  logger.info("Job auto-cleanup started", {
    intervalHours: cleanupConfig.intervalHours,
    maxAgeHours: cleanupConfig.maxAgeHours,
  });
}

/**
 * Stops the auto-cleanup timer
 */
export function stopAutoCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    logger.info("Job auto-cleanup stopped");
  }
}

/**
 * Gets job statistics
 */
export function getJobStats(): {
  total: number;
  processing: number;
  completed: number;
  failed: number;
} {
  const jobs = getAllJobs();
  return {
    total: jobs.length,
    processing: jobs.filter((job) => job.status === "processing").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  };
}

// Start auto-cleanup when the module is loaded
startAutoCleanup();
