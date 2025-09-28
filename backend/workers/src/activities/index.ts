// Unified activities implementation
import { createWorkerLogger } from '../shared/logger';

// Export all activities
export * from './fileProcessing';
export * from './storage';
export * from './directusStorage';
export * from './classify';

const logger = createWorkerLogger('activities');

// Type definitions (matching orchestration-api)
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

// Activity implementations
export async function classifyDocument(input: ClassifyDocumentInput): Promise<ClassifyDocumentResult> {
  logger.info('Classifying document', { docId: input.docId });
  
  try {
    // Basic mock implementation - in real app this would:
    // 1. Download document from storage
    // 2. Analyze content type and basic structure
    // 3. Apply ML models or rule-based classification
    // 4. Return classification with confidence score
    
    const result: ClassifyDocumentResult = {
      docType: 'invoice', // Mock classification
      confidence: 0.95,
      metadata: {
        classifier: 'unified-worker-v1',
        timestamp: new Date().toISOString(),
        method: 'mock' // Would be 'ml-model' or 'rule-based' in real implementation
      }
    };
    
    logger.info('Document classified successfully', { 
      docId: input.docId, 
      docType: result.docType,
      confidence: result.confidence 
    });
    
    return result;
  } catch (error) {
    logger.error('Document classification failed', { docId: input.docId, error });
    throw error;
  }
}

export async function parsePdfOrOcr(input: ParsePdfOrOcrInput): Promise<ParsePdfOrOcrResult> {
  logger.info('Parsing PDF or performing OCR', { docId: input.docId });
  
  try {
    // Basic mock implementation - in real app this would:
    // 1. Download document from storage
    // 2. Check content type (PDF vs image)
    // 3. For PDFs: extract text using pdf-parse
    // 4. For images: perform OCR using Tesseract
    // 5. Store extracted text back to storage
    
    const result: ParsePdfOrOcrResult = {
      pages: 1,
      text: 'Mock extracted text from document\nInvoice Number: INV-2024-001\nAmount: 1,234.56 CZK\nDue Date: 2024-12-31',
      layout: {
        pages: [{ width: 595, height: 842 }],
        method: 'mock' // Would be 'pdf-parse' or 'ocr' in real implementation
      },
      ocrConfidence: 0.98
    };
    
    logger.info('Document parsed successfully', { 
      docId: input.docId, 
      pages: result.pages,
      textLength: result.text.length 
    });
    
    return result;
  } catch (error) {
    logger.error('Document parsing failed', { docId: input.docId, error });
    throw error;
  }
}

export async function extractWithLLM(input: ExtractWithLLMInput): Promise<ExtractWithLLMResult> {
  logger.info('Extracting data with LLM', { docId: input.docId });
  
  try {
    // TODO: Implement actual LLM extraction logic
    // For now, return a mock result
    const result: ExtractWithLLMResult = {
      fields: {
        invoiceNumber: 'INV-2024-001',
        amount: 1234.56,
        currency: 'CZK',
        dueDate: '2024-12-31'
      },
      confidence: {
        invoiceNumber: 0.99,
        amount: 0.95,
        currency: 0.98,
        dueDate: 0.92
      },
      metadata: {
        model: 'gemini-2.5-flash',
        timestamp: new Date().toISOString()
      }
    };
    
    logger.info('LLM extraction completed successfully', { 
      docId: input.docId, 
      fieldsExtracted: Object.keys(result.fields).length 
    });
    
    return result;
  } catch (error) {
    logger.error('LLM extraction failed', { docId: input.docId, error });
    throw error;
  }
}

export async function validateAndEnrich(input: ValidateAndEnrichInput): Promise<ValidateAndEnrichResult> {
  logger.info('Validating and enriching data', { docId: input.docId });
  
  try {
    // TODO: Implement actual validation and enrichment logic
    // For now, return a mock result
    const result: ValidateAndEnrichResult = {
      isValid: true,
      needsReview: false, // Set to true for human-in-the-loop testing
      validationErrors: [],
      enrichedData: {
        supplierVerified: true,
        taxRateApplied: 0.21,
        enrichmentTimestamp: new Date().toISOString()
      }
    };
    
    logger.info('Validation and enrichment completed', { 
      docId: input.docId, 
      isValid: result.isValid,
      needsReview: result.needsReview 
    });
    
    return result;
  } catch (error) {
    logger.error('Validation and enrichment failed', { docId: input.docId, error });
    throw error;
  }
}

export async function exportCsv(input: ExportCsvInput): Promise<ExportCsvResult> {
  logger.info('Exporting to CSV', { docId: input.docId });
  
  try {
    // TODO: Implement actual CSV export logic
    // For now, return a mock result
    const filename = `export_${input.docId}_${Date.now()}.csv`;
    const result: ExportCsvResult = {
      filename,
      path: `/exports/${filename}`,
      rowCount: 1
    };
    
    logger.info('CSV export completed', { 
      docId: input.docId, 
      filename: result.filename,
      rowCount: result.rowCount 
    });
    
    return result;
  } catch (error) {
    logger.error('CSV export failed', { docId: input.docId, error });
    throw error;
  }
}

export async function deliverToTarget(input: DeliverToTargetInput): Promise<DeliverToTargetResult> {
  logger.info('Delivering to target systems', { docId: input.docId, exportPath: input.exportPath });
  
  try {
    // TODO: Implement actual delivery logic (SFTP, APIs, etc.)
    // For now, return a mock result
    const result: DeliverToTargetResult = {
      targets: ['mock-system'],
      deliveryIds: [`delivery_${Date.now()}`],
      status: 'completed'
    };
    
    logger.info('Delivery completed', { 
      docId: input.docId, 
      targets: result.targets,
      status: result.status 
    });
    
    return result;
  } catch (error) {
    logger.error('Delivery failed', { docId: input.docId, error });
    throw error;
  }
}

export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
  logger.info('Sending notification', { 
    type: input.type, 
    docId: input.docId, 
    message: input.message 
  });
  
  try {
    // TODO: Implement actual notification logic (Slack, email, etc.)
    // For now, return a mock result
    const result: SendNotificationResult = {
      sent: true,
      channels: ['console'] // Mock channel
    };
    
    logger.info('Notification sent successfully', { 
      docId: input.docId, 
      type: input.type,
      channels: result.channels 
    });
    
    return result;
  } catch (error) {
    logger.error('Notification sending failed', { docId: input.docId, error });
    throw error;
  }
}
