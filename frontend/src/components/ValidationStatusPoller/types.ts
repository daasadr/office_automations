export interface ValidationData {
  validationResult: {
    present: string[];
    missing: string[];
    confidence: number;
  };
  directusSourceDocumentId?: string;
  status?: string;
}

export interface ValidationStatusPollerProps {
  documentId?: string;
  jobId?: string;
}
