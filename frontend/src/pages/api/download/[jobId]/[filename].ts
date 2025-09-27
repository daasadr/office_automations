import type { APIRoute } from 'astro';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { jobId, filename } = params;

    if (!jobId || !filename) {
      return new Response('Job ID and filename are required.', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Forward the request to the backend orchestration API
    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/download/${jobId}/${filename}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText || 'Backend download failed', { 
        status: response.status,
        headers: { 'Content-Type': 'text/plain' }
      });
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

    return new Response(response.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Download API error:', error);
    
    return new Response('Internal server error. Please try again later.', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

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
