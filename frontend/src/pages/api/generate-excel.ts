import type { APIRoute } from 'astro';
import { withLogging, createErrorResponse, loggedFetch, RequestTimer } from '../../lib/middleware';
import { generateRequestId } from '../../lib/logger';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

const generateExcelHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();
  const timer = new RequestTimer();
  
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return createErrorResponse(
        'Job ID is required',
        { status: 400, requestId }
      );
    }

    // Forward the request to the backend orchestration API
    const backendResponse = await loggedFetch(`${ORCHESTRATION_API_URL}/documents/generate-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
      requestId
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ error: 'Backend request failed' }));
      return createErrorResponse(
        errorData.error || 'Failed to generate Excel file',
        { 
          status: backendResponse.status, 
          requestId,
          details: errorData.details 
        }
      );
    }

    // Get the Excel file buffer from backend
    const excelBuffer = await backendResponse.arrayBuffer();
    
    // Extract filename from Content-Disposition header
    const contentDisposition = backendResponse.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || `odpady_${jobId}.xlsx`;

    // Return the Excel file with proper headers
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBuffer.byteLength.toString(),
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    return createErrorResponse(
      'Failed to generate Excel file',
      { 
        status: 500, 
        requestId,
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
};

export const POST = withLogging(generateExcelHandler);
