import type { APIRoute } from 'astro';

const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Starting PDF validation...');
    const formData = await request.formData();
    const file = formData.get('file');
    const provider = formData.get('provider') as string || 'auto';

    if (!file || !(file instanceof File)) {
      console.error('No file or invalid file in request');
      return new Response(JSON.stringify({ error: 'Nebyl nahrán žádný soubor' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
      provider: provider
    });

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
      return new Response(JSON.stringify({
        error: result.error || 'Backend processing failed',
        details: result.details
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    let errorMessage = 'Došlo k chybě při zpracování souboru';
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      errorMessage = `Chyba: ${error.message}`;
    }

    return new Response(JSON.stringify({
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};