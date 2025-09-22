// Simple in-memory store for validation results
// In production, you'd want to use Redis or a database
import type { ExtractedData } from './openai';

interface ValidationResult {
  present: string[];
  missing: string[];
  confidence: number;
  imagePreview: string;
  extracted_data?: ExtractedData[];
  timestamp: number;
}

const validationStore = new Map<string, ValidationResult>();

// Clean up old entries (older than 1 hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_AGE = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of validationStore.entries()) {
    if (now - value.timestamp > MAX_AGE) {
      validationStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export function storeValidationResult(jobId: string, result: Omit<ValidationResult, 'timestamp'>): void {
  validationStore.set(jobId, {
    ...result,
    timestamp: Date.now(),
  });
}

export function getValidationResult(jobId: string): ValidationResult | null {
  const result = validationStore.get(jobId);
  if (!result) return null;
  
  // Check if expired
  if (Date.now() - result.timestamp > MAX_AGE) {
    validationStore.delete(jobId);
    return null;
  }
  
  return result;
}
