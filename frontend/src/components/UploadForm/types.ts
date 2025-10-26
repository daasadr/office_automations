export interface UploadResult {
  jobId: string;
  directusSourceDocumentId?: string;
  requestId?: string;
}

export interface UploadError {
  error: string;
  requestId?: string;
  details?: unknown;
}

export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export interface UploadState {
  isSubmitting: boolean;
  showProcessing: boolean;
  selectedFile: File | null;
}
