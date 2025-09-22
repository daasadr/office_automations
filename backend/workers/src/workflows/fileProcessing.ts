import { 
  defineSignal, 
  defineQuery, 
  setHandler, 
  condition, 
  proxyActivities,
  sleep,
  log as workflowLog
} from '@temporalio/workflow';

// Import activity types
import type { 
  ProcessPdfInput,
  ProcessPdfResult,
  ValidateWasteDocumentInput,
  WasteValidationResult,
  StoreDocumentInput,
  StoreDocumentResult,
  StoreArtifactInput,
  StoreArtifactResult,
  UpdateDocumentStatusInput,
  CreateExtractionJobInput,
  StoreExtractionResultInput
} from '../activities';

// Create activity proxies with appropriate timeouts
const {
  processPdfFile,
  validateWasteDocument,
  storeDocument,
  storeArtifact,
  updateDocumentStatus,
  createExtractionJob,
  storeExtractionResult
} = proxyActivities<{
  processPdfFile(input: ProcessPdfInput): Promise<ProcessPdfResult>;
  validateWasteDocument(input: ValidateWasteDocumentInput): Promise<WasteValidationResult>;
  storeDocument(input: StoreDocumentInput): Promise<StoreDocumentResult>;
  storeArtifact(input: StoreArtifactInput): Promise<StoreArtifactResult>;
  updateDocumentStatus(input: UpdateDocumentStatusInput): Promise<{ success: boolean; error?: string }>;
  createExtractionJob(input: CreateExtractionJobInput): Promise<{ success: boolean; jobId?: string; error?: string }>;
  storeExtractionResult(input: StoreExtractionResultInput): Promise<{ success: boolean; extractionId?: string; error?: string }>;
}>({
  startToCloseTimeout: '10 minutes', // Generous timeout for file processing
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    maximumAttempts: 3,
  }
});

// Workflow input
export interface ProcessFileWorkflowInput {
  jobId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
  processingType: 'waste-validation' | 'generic-extraction';
}

// Workflow state
export interface ProcessFileWorkflowState {
  jobId: string;
  fileName: string;
  status: 'uploading' | 'processing' | 'validating' | 'storing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  error?: string;
  result?: {
    document?: StoreDocumentResult;
    processedImages?: ProcessPdfResult;
    validation?: WasteValidationResult;
    artifacts?: StoreArtifactResult[];
    extractionResult?: { success: boolean; extractionId?: string; error?: string };
  };
}

// Signals for workflow control
export const cancelProcessingSignal = defineSignal<[]>('cancelProcessing');
export const retryCurrentStepSignal = defineSignal<[]>('retryCurrentStep');

// Queries for workflow state
export const getWorkflowStateQuery = defineQuery<ProcessFileWorkflowState>('getWorkflowState');
export const getProcessingProgressQuery = defineQuery<number>('getProcessingProgress');

/**
 * Main file processing workflow
 * Handles the complete pipeline from file upload to validation result storage
 */
export async function processFileWorkflow(input: ProcessFileWorkflowInput): Promise<ProcessFileWorkflowState> {
  workflowLog.info('Starting file processing workflow', {
    jobId: input.jobId,
    fileName: input.fileName,
    fileSize: input.fileBuffer.length,
    processingType: input.processingType
  });

  // Initialize workflow state
  let state: ProcessFileWorkflowState = {
    jobId: input.jobId,
    fileName: input.fileName,
    status: 'uploading',
    progress: 0,
    currentStep: 'Initializing file processing',
    result: {}
  };

  let cancelled = false;
  let retryRequested = false;

  // Set up signal handlers
  setHandler(cancelProcessingSignal, () => {
    cancelled = true;
    workflowLog.info('Processing cancelled by signal', { jobId: input.jobId });
  });

  setHandler(retryCurrentStepSignal, () => {
    retryRequested = true;
    workflowLog.info('Retry requested by signal', { jobId: input.jobId });
  });

  // Set up query handlers
  setHandler(getWorkflowStateQuery, () => state);
  setHandler(getProcessingProgressQuery, () => state.progress);

  try {
    // Step 1: Store original document in Directus
    if (!cancelled) {
      state.status = 'uploading';
      state.progress = 10;
      state.currentStep = 'Storing original document in Directus';
      workflowLog.info('Step 1: Storing original document', { jobId: input.jobId });

      const storeDocumentInput: StoreDocumentInput = {
        jobId: input.jobId,
        fileName: input.fileName,
        fileBuffer: input.fileBuffer,
        contentType: input.contentType,
        source: 'upload',
        workflowId: `file-processing-${input.jobId}`,
        title: input.fileName
      };

      state.result.document = await storeDocument(storeDocumentInput);
      
      if (!state.result.document.success) {
        throw new Error(`Failed to store document: ${state.result.document.error}`);
      }

      // Create extraction job record for tracking
      if (state.result.document.documentId) {
        await createExtractionJob({
          documentId: state.result.document.documentId,
          workflowId: `file-processing-${input.jobId}`,
          runId: input.jobId,
          state: 'running',
          step: 'document_stored'
        });

        // Update document status to processing
        await updateDocumentStatus({
          documentId: state.result.document.documentId,
          status: 'processing',
          notes: 'File uploaded and processing started'
        });
      }

      workflowLog.info('Original document stored successfully', { 
        jobId: input.jobId,
        documentId: state.result.document.documentId,
        fileId: state.result.document.fileId
      });
    }

    // Step 2: Process PDF (convert to images)
    if (!cancelled) {
      state.status = 'processing';
      state.progress = 30;
      state.currentStep = 'Converting PDF to images';
      workflowLog.info('Step 2: Processing PDF file', { jobId: input.jobId });

      const processPdfInput: ProcessPdfInput = {
        jobId: input.jobId,
        fileName: input.fileName,
        fileBuffer: input.fileBuffer
      };

      state.result.processedImages = await processPdfFile(processPdfInput);
      
      if (!state.result.processedImages.success) {
        throw new Error(`Failed to process PDF: ${state.result.processedImages.error}`);
      }

      workflowLog.info('PDF processed successfully', { 
        jobId: input.jobId,
        pageCount: state.result.processedImages.pageCount
      });
    }

    // Step 3: Validate with LLM (if waste validation)
    if (!cancelled && input.processingType === 'waste-validation' && state.result.processedImages) {
      state.status = 'validating';
      state.progress = 60;
      state.currentStep = 'Validating document with AI';
      workflowLog.info('Step 3: Validating waste document', { jobId: input.jobId });

      const validateInput: ValidateWasteDocumentInput = {
        jobId: input.jobId,
        fileName: input.fileName,
        processedImages: state.result.processedImages.processedImages
      };

      state.result.validation = await validateWasteDocument(validateInput);
      
      if (!state.result.validation.success) {
        throw new Error(`Failed to validate document: ${state.result.validation.error}`);
      }

      workflowLog.info('Document validated successfully', { 
        jobId: input.jobId,
        confidence: state.result.validation.confidence,
        extractedRecords: state.result.validation.extractedData.length
      });
    }

    // Step 4: Store processed artifacts and validation results in Directus
    if (!cancelled && state.result.validation && state.result.processedImages && state.result.document?.documentId) {
      state.status = 'storing';
      state.progress = 80;
      state.currentStep = 'Storing processed artifacts';
      workflowLog.info('Step 4: Storing processed artifacts', { jobId: input.jobId });

      const documentId = state.result.document.documentId;
      state.result.artifacts = [];

      // Store preview image as artifact
      if (state.result.processedImages.previewImage) {
        const previewBuffer = Buffer.from(
          state.result.processedImages.previewImage.split(',')[1], 
          'base64'
        );
        
        const previewArtifact = await storeArtifact({
          documentId,
          kind: 'preview',
          fileBuffer: previewBuffer,
          format: 'webp',
          contentType: 'image/webp',
          metadata: {
            type: 'preview',
            totalPages: state.result.processedImages.pageCount
          }
        });

        if (previewArtifact.success) {
          state.result.artifacts.push(previewArtifact);
        }
      }

      // Store all processed page images as artifacts
      for (let i = 0; i < state.result.processedImages.processedImages.length; i++) {
        const imageData = state.result.processedImages.processedImages[i];
        const imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
        
        const imageArtifact = await storeArtifact({
          documentId,
          kind: 'image',
          fileBuffer: imageBuffer,
          format: 'webp',
          contentType: 'image/webp',
          pageNo: i + 1,
          metadata: {
            type: 'processed_page',
            pageNumber: i + 1,
            resolution: '300dpi'
          }
        });

        if (imageArtifact.success) {
          state.result.artifacts.push(imageArtifact);
        }
      }

      // Store extraction results
      state.progress = 90;
      state.currentStep = 'Storing extraction results';
      
      state.result.extractionResult = await storeExtractionResult({
        documentId,
        schemaKey: 'waste_validation',
        schemaVersion: '1.0',
        extractedData: state.result.validation,
        confidenceScore: state.result.validation.confidence,
        validationStatus: state.result.validation.confidence > 80 ? 'valid' : 'needs_review'
      });

      if (!state.result.extractionResult.success) {
        throw new Error(`Failed to store extraction result: ${state.result.extractionResult.error}`);
      }

      // Update document status based on validation results
      const finalStatus = state.result.validation.confidence > 80 ? 'approved' : 'needs_review';
      await updateDocumentStatus({
        documentId,
        status: finalStatus,
        notes: `Processing completed. Confidence: ${state.result.validation.confidence}%`,
        metadata: {
          processingCompleted: new Date().toISOString(),
          confidence: state.result.validation.confidence,
          extractedRecords: state.result.validation.extractedData.length,
          missingFields: state.result.validation.missing.length
        }
      });

      workflowLog.info('Artifacts and results stored successfully', { 
        jobId: input.jobId,
        documentId,
        artifactCount: state.result.artifacts.length,
        extractionId: state.result.extractionResult.extractionId
      });
    }

    // Workflow completed successfully
    state.status = 'completed';
    state.progress = 100;
    state.currentStep = 'Processing completed successfully';
    
    workflowLog.info('File processing workflow completed successfully', {
      jobId: input.jobId,
      fileName: input.fileName,
      finalStatus: state.status
    });

  } catch (error) {
    // Handle workflow errors
    state.status = 'failed';
    state.error = error instanceof Error ? error.message : 'Unknown error occurred';
    state.currentStep = `Failed: ${state.error}`;
    
    workflowLog.error('File processing workflow failed', {
      jobId: input.jobId,
      error: state.error,
      currentStep: state.currentStep
    });
  }

  // If cancelled, update status
  if (cancelled) {
    state.status = 'failed';
    state.error = 'Processing was cancelled';
    state.currentStep = 'Cancelled by user';
  }

  return state;
}

/**
 * Simple file upload workflow for non-PDF files
 */
export interface UploadFileWorkflowInput {
  jobId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}

export async function uploadFileWorkflow(input: UploadFileWorkflowInput): Promise<StoreDocumentResult> {
  workflowLog.info('Starting simple file upload workflow', {
    jobId: input.jobId,
    fileName: input.fileName,
    fileSize: input.fileBuffer.length
  });

  const storeDocumentInput: StoreDocumentInput = {
    jobId: input.jobId,
    fileName: input.fileName,
    fileBuffer: input.fileBuffer,
    contentType: input.contentType,
    source: 'upload',
    title: input.fileName
  };

  const result = await storeDocument(storeDocumentInput);
  
  if (result.success) {
    workflowLog.info('File uploaded successfully to Directus', {
      jobId: input.jobId,
      documentId: result.documentId,
      fileId: result.fileId
    });

    // Update document status to completed for simple uploads
    if (result.documentId) {
      await updateDocumentStatus({
        documentId: result.documentId,
        status: 'received',
        notes: 'File uploaded successfully - no processing required'
      });
    }
  } else {
    workflowLog.error('File upload failed', {
      jobId: input.jobId,
      error: result.error
    });
  }

  return result;
}
