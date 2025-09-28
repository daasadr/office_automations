import type { APIRoute } from 'astro';
import { withLogging, createErrorResponse, loggedFetch } from '../../../lib/middleware';
import { generateRequestId } from '../../../lib/logger';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

const downloadHandler: APIRoute = async ({ params }) => {
  const requestId = generateRequestId();
  try {
    const { jobId, filename } = params;

    if (!jobId || !filename) {
      return createErrorResponse(
        'Job ID and filename are required',
        { status: 400, requestId }
      );
    }

    // Forward the request to the backend orchestration API
    const response = await loggedFetch(`${ORCHESTRATION_API_URL}/documents/download/${jobId}/${filename}`, {
      method: 'GET',
      requestId
    });

    if (!response.ok) {
      const errorText = await response.text();
      return createErrorResponse(
        errorText || 'Backend download failed',
        { status: response.status, requestId }
      );
    }

    // Get the response as a stream and forward it
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentLength = response.headers.get('Content-Length');

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
    }
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('X-Request-ID', requestId);

    return new Response(response.body, {
      status: 200,
      headers
    });

  } catch (error) {
    return createErrorResponse(
      'Internal server error. Please try again later.',
      { status: 500, requestId }
    );
  }
};

export const GET = withLogging(downloadHandler);

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
