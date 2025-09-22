import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { jobId, filename } = params;

    if (!jobId || !filename) {
      return new Response('Job ID and filename are required.', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Simulate file download for demo
    // In a real implementation, this would serve actual files
    const sampleContent = `Sample processed data for job: ${jobId}\nFilename: ${filename}\nGenerated at: ${new Date().toISOString()}`;

    const headers = new Headers();
    headers.set('Content-Type', 'text/plain');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(sampleContent, {
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
