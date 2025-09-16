// Activity definitions for document processing workflow
// These are interfaces that will be implemented by worker services

export interface ClassifyDocumentInput {
  docId: string;
}

export interface ClassifyDocumentResult {
  docType: string;
  confidence: number;
  metadata: any;
}

export interface ParsePdfOrOcrInput {
  docId: string;
}

export interface ParsePdfOrOcrResult {
  pages: number;
  text: string;
  layout: any;
  ocrConfidence?: number;
}

export interface ExtractWithLLMInput {
  docId: string;
}

export interface ExtractWithLLMResult {
  fields: Record<string, any>;
  confidence: Record<string, number>;
  metadata: any;
}

export interface ValidateAndEnrichInput {
  docId: string;
}

export interface ValidateAndEnrichResult {
  isValid: boolean;
  needsReview: boolean;
  validationErrors: string[];
  enrichedData: any;
}

export interface ExportCsvInput {
  docId: string;
  patch?: any;
}

export interface ExportCsvResult {
  filename: string;
  path: string;
  rowCount: number;
}

export interface DeliverToTargetInput {
  docId: string;
  exportPath: string;
}

export interface DeliverToTargetResult {
  targets: string[];
  deliveryIds: string[];
  status: 'completed' | 'partial' | 'failed';
}

export interface SendNotificationInput {
  type: 'needs_review' | 'delivered' | 'failed';
  docId: string;
  message: string;
  error?: string;
}

export interface SendNotificationResult {
  sent: boolean;
  channels: string[];
}

// Activity function signatures
export async function classifyDocument(input: ClassifyDocumentInput): Promise<ClassifyDocumentResult> {
  throw new Error('Activity implementation should be provided by worker');
}

export async function parsePdfOrOcr(input: ParsePdfOrOcrInput): Promise<ParsePdfOrOcrResult> {
  throw new Error('Activity implementation should be provided by worker');
}

export async function extractWithLLM(input: ExtractWithLLMInput): Promise<ExtractWithLLMResult> {
  throw new Error('Activity implementation should be provided by worker');
}

export async function validateAndEnrich(input: ValidateAndEnrichInput): Promise<ValidateAndEnrichResult> {
  throw new Error('Activity implementation should be provided by worker');
}

export async function exportCsv(input: ExportCsvInput): Promise<ExportCsvResult> {
  throw new Error('Activity implementation should be provided by worker');
}

export async function deliverToTarget(input: DeliverToTargetInput): Promise<DeliverToTargetResult> {
  throw new Error('Activity implementation should be provided by worker');
}

export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
  throw new Error('Activity implementation should be provided by worker');
}


