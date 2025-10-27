import { logger } from "@orchestration-api/utils/logger";
import type { ValidationResult } from "@orchestration-api/services/llm";

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

/**
 * Service class for managing job lifecycle and state.
 *
 * This service handles:
 * - Creating and tracking async jobs
 * - Storing job state and results in memory
 * - Managing job lifecycle (processing -> completed/failed)
 * - Auto-cleanup of old jobs
 * - Job statistics and retrieval
 *
 * @example
 * ```typescript
 * // Use the singleton instance
 * import { jobService } from './JobService';
 *
 * // Create a new job
 * const jobId = jobService.generateJobId();
 * const job = jobService.createJob(jobId, 'document.pdf', 12345);
 *
 * // Update job status
 * jobService.completeJob(jobId, validationResult, 'gemini');
 *
 * // Retrieve job
 * const job = jobService.getJob(jobId);
 * ```
 */
export class JobService {
  private jobStore: Map<string, JobData>;
  private cleanupTimer: NodeJS.Timeout | null;
  private cleanupConfig: JobCleanupConfig;

  constructor() {
    this.jobStore = new Map<string, JobData>();
    this.cleanupTimer = null;
    this.cleanupConfig = {
      maxAgeHours: parseInt(process.env.JOB_CLEANUP_MAX_AGE_HOURS || "24", 10),
      intervalHours: parseInt(process.env.JOB_CLEANUP_INTERVAL_HOURS || "1", 10),
      enabled: process.env.JOB_CLEANUP_ENABLED !== "false",
    };

    // Start auto-cleanup on instantiation
    this.startAutoCleanup();
  }

  /**
   * Generates a unique job ID
   */
  generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Creates a new job
   */
  createJob(jobId: string, fileName?: string, fileSize?: number): JobData {
    const job: JobData = {
      jobId,
      status: "processing",
      fileName,
      fileSize,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobStore.set(jobId, job);
    logger.info("Job created", { jobId, fileName, fileSize });

    return job;
  }

  /**
   * Updates an existing job
   */
  updateJob(jobId: string, updates: Partial<JobData>): JobData | null {
    const job = this.jobStore.get(jobId);
    if (!job) {
      logger.warn("Job not found for update", { jobId });
      return null;
    }

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date(),
    };

    this.jobStore.set(jobId, updatedJob);
    logger.info("Job updated", { jobId, updates: Object.keys(updates) });

    return updatedJob;
  }

  /**
   * Retrieves a job by ID
   */
  getJob(jobId: string): JobData | null {
    const job = this.jobStore.get(jobId);
    if (!job) {
      logger.warn("Job not found", { jobId });
      return null;
    }

    return job;
  }

  /**
   * Marks a job as completed
   */
  completeJob(
    jobId: string,
    validationResult: ValidationResult,
    provider: "gemini"
  ): JobData | null {
    const updates: Partial<JobData> = {
      status: "completed",
      validationResult,
      provider,
    };

    return this.updateJob(jobId, updates);
  }

  /**
   * Marks a job as failed
   */
  failJob(jobId: string, error: string): JobData | null {
    const updates: Partial<JobData> = {
      status: "failed",
      error,
    };

    return this.updateJob(jobId, updates);
  }

  /**
   * Sets Excel data for a job
   */
  setJobExcel(jobId: string, excelBuffer: Buffer, excelFilename: string): JobData | null {
    const updates: Partial<JobData> = {
      excelBuffer,
      excelFilename,
    };

    return this.updateJob(jobId, updates);
  }

  /**
   * Gets all jobs sorted by creation date
   */
  getAllJobs(): JobData[] {
    return Array.from(this.jobStore.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Cleans up old jobs based on age
   */
  cleanupOldJobs(maxAgeHours?: number): number {
    const hours = maxAgeHours ?? this.cleanupConfig.maxAgeHours;
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobStore.entries()) {
      if (job.createdAt < cutoffTime) {
        this.jobStore.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info("Cleaned up old jobs", { cleanedCount, maxAgeHours: hours });
    }

    return cleanedCount;
  }

  /**
   * Starts the auto-cleanup timer
   */
  startAutoCleanup(): void {
    if (!this.cleanupConfig.enabled) {
      logger.info("Job auto-cleanup is disabled");
      return;
    }

    if (this.cleanupTimer) {
      logger.warn("Auto-cleanup timer is already running");
      return;
    }

    const intervalMs = this.cleanupConfig.intervalHours * 60 * 60 * 1000;

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, intervalMs);

    logger.info("Job auto-cleanup started", {
      intervalHours: this.cleanupConfig.intervalHours,
      maxAgeHours: this.cleanupConfig.maxAgeHours,
    });
  }

  /**
   * Stops the auto-cleanup timer
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info("Job auto-cleanup stopped");
    }
  }

  /**
   * Gets job statistics
   */
  getJobStats(): {
    total: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const jobs = this.getAllJobs();
    return {
      total: jobs.length,
      processing: jobs.filter((job) => job.status === "processing").length,
      completed: jobs.filter((job) => job.status === "completed").length,
      failed: jobs.filter((job) => job.status === "failed").length,
    };
  }
}

// Export singleton instance
export const jobService = new JobService();
