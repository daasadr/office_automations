import type { APIRoute } from 'astro';

/**
 * DEPRECATED: PDF validation is now handled by Temporal workflows
 * Use the /api/upload endpoint instead, which supports PDF files
 * and automatically triggers the appropriate processing workflow.
 */

export const POST: APIRoute = async ({ request }) => {
  return new Response(JSON.stringify({
    error: 'This endpoint is deprecated. Please use /api/upload for file processing.',
    details: 'PDF validation is now handled by Temporal workflows through the upload endpoint.',
    migration: {
      newEndpoint: '/api/upload',
      supportedTypes: ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      note: 'The upload endpoint will automatically detect PDF files and trigger waste validation workflows.'
    }
  }), {
    status: 410, // Gone - indicates the endpoint is deprecated
    headers: {
      'Content-Type': 'application/json',
    },
  });
};