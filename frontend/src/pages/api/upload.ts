import type { APIRoute } from 'astro';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check content type
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid content type. Expected multipart/form-data.' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const provider = formData.get('provider') as string || 'auto';

    if (!file || file.size === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file uploaded or file is empty.' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file type - now accepting PDFs for document processing
    const allowedTypes = [
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid file type. Please upload a PDF file.' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File too large. Maximum size is 10MB.' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Forward the request to the backend orchestration API
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('provider', provider);

    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/validate-pdf`, {
      method: 'POST',
      body: backendFormData,
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || 'Backend processing failed',
          details: result.details
        }),
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Upload API error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error. Please try again later.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

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
