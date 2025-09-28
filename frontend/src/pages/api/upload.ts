import type { APIRoute } from 'astro';
import { withLogging, createErrorResponse, createSuccessResponse, loggedFetch, RequestTimer } from '../../lib/middleware';
import { generateRequestId, logUploadProgress, logSecurityEvent } from '../../lib/logger';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

const uploadHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();
  const timer = new RequestTimer();
  try {
    // Check content type
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      logSecurityEvent({
        requestId,
        event: 'invalid_request',
        details: { contentType: request.headers.get('content-type') }
      }, 'Invalid content type for upload');
      
      return createErrorResponse(
        'Invalid content type. Expected multipart/form-data.',
        { status: 400, requestId }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const provider = formData.get('provider') as string || 'auto';

    if (!file || file.size === 0) {
      logSecurityEvent({
        requestId,
        event: 'invalid_request',
        details: { reason: 'no_file_or_empty' }
      }, 'No file uploaded or file is empty');
      
      return createErrorResponse(
        'No file uploaded or file is empty.',
        { status: 400, requestId }
      );
    }

    // Log upload start
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: 'validation'
    });

    // Validate file type - now accepting PDFs for document processing
    const allowedTypes = [
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      logSecurityEvent({
        requestId,
        event: 'invalid_file_type',
        details: { 
          filename: file.name,
          fileType: file.type,
          allowedTypes 
        }
      }, `Invalid file type: ${file.type}`);
      
      return createErrorResponse(
        'Invalid file type. Please upload a PDF file.',
        { status: 400, requestId }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      logSecurityEvent({
        requestId,
        event: 'file_too_large',
        details: { 
          filename: file.name,
          fileSize: file.size,
          maxSize 
        }
      }, `File too large: ${file.size} bytes`);
      
      return createErrorResponse(
        'File too large. Maximum size is 10MB.',
        { status: 400, requestId }
      );
    }

    // Log upload stage
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: 'upload'
    });

    // Forward the request to the backend orchestration API
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('provider', provider);

    const response = await loggedFetch(`${ORCHESTRATION_API_URL}/documents/validate-pdf`, {
      method: 'POST',
      body: backendFormData,
      requestId
    });

    const result = await response.json();

    if (!response.ok) {
      logUploadProgress({
        requestId,
        filename: file.name,
        fileSize: file.size,
        stage: 'error',
        duration: timer.getDuration(),
        error: new Error(result.error || 'Backend processing failed')
      });
      
      return createErrorResponse(
        result.error || 'Backend processing failed',
        { 
          status: response.status, 
          requestId,
          details: result.details 
        }
      );
    }

    // Log successful completion
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: 'complete',
      duration: timer.getDuration()
    });

    return createSuccessResponse(result, {
      requestId,
      message: 'File uploaded and processed successfully'
    });

  } catch (error) {
    logUploadProgress({
      requestId,
      filename: 'unknown',
      fileSize: 0,
      stage: 'error',
      duration: timer.getDuration(),
      error: error instanceof Error ? error : new Error(String(error))
    });
    
    return createErrorResponse(
      'Internal server error. Please try again later.',
      { 
        status: 500, 
        requestId,
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
};

export const POST = withLogging(uploadHandler);

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
