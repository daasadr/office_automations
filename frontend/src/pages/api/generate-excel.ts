import type { APIRoute } from 'astro';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward the request to the backend orchestration API
    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/generate-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const errorResult = await response.json();
      return new Response(JSON.stringify({
        error: errorResult.error || 'Backend Excel generation failed',
        details: errorResult.details
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the response as a stream and forward it
    const contentType = response.headers.get('Content-Type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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

    return new Response(response.body, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error generating Excel file:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate Excel file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
