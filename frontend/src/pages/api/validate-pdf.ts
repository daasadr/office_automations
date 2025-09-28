import type { APIRoute } from 'astro';
import { withLogging, createErrorResponse, createSuccessResponse, loggedFetch, RequestTimer } from '../../lib/middleware';
import { generateRequestId, logUploadProgress, logSecurityEvent } from '../../lib/logger';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

const validatePdfHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();
  const timer = new RequestTimer();
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const provider = formData.get('provider') as string || 'auto';

    if (!file || !(file instanceof File)) {
      logSecurityEvent({
        requestId,
        event: 'invalid_request',
        details: { reason: 'no_file_or_invalid_file' }
      }, 'No file or invalid file in request');
      
      return createErrorResponse(
        'Nebyl nahrán žádný soubor',
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

    // Validate file type
    if (file.type !== 'application/pdf') {
      logSecurityEvent({
        requestId,
        event: 'invalid_file_type',
        details: { 
          filename: file.name,
          fileType: file.type,
          expected: 'application/pdf'
        }
      }, `Invalid file type: ${file.type}`);
      
      return createErrorResponse(
        'Neplatný typ souboru. Prosím nahrajte PDF soubor.',
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
        'Soubor je příliš velký. Maximální velikost je 10MB.',
        { status: 400, requestId }
      );
    }

    // Log processing stage
    logUploadProgress({
      requestId,
      filename: file.name,
      fileSize: file.size,
      stage: 'processing'
    });

    // Forward the request to the backend orchestration API
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('provider', provider);

    const backendResponse = await loggedFetch(`${ORCHESTRATION_API_URL}/documents/validate-pdf`, {
      method: 'POST',
      body: backendFormData,
      requestId
    });

    const result = await backendResponse.json();

    if (!backendResponse.ok) {
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
          status: backendResponse.status, 
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
      message: 'PDF validation completed successfully'
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
      'Došlo k chybě při zpracování souboru',
      { 
        status: 500, 
        requestId,
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
};

export const POST = withLogging(validatePdfHandler);