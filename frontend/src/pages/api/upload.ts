import type { APIRoute } from 'astro';

// Temporal client for workflow execution
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

    // Validate file type - now supporting PDF files for waste validation
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf' // Added PDF support
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid file type. Please upload a CSV, Excel, or PDF file.' 
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

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Convert file to buffer for workflow
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Determine processing type based on file type
    const processingType = file.type === 'application/pdf' ? 'waste-validation' : 'generic-extraction';

    // Forward to orchestration API to start Temporal workflow
    const workflowPayload = {
      jobId,
      fileName: file.name,
      fileBuffer: Array.from(fileBuffer), // Convert to array for JSON serialization
      contentType: file.type,
      processingType
    };

    const response = await fetch(`${ORCHESTRATION_API_URL}/workflows/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowType: 'processFileWorkflow',
        workflowId: `file-processing-${jobId}`,
        input: workflowPayload
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Workflow start failed: ${errorData.error || response.statusText}`);
    }

    const workflowResult = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId,
        workflowId: workflowResult.workflowId,
        message: 'File uploaded successfully and processing started via Temporal workflow.'
      }),
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
        error: error instanceof Error ? error.message : 'Internal server error. Please try again later.' 
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
