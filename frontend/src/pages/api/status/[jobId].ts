import type { APIRoute } from 'astro';

// Orchestration API URL
const ORCHESTRATION_API_URL = import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001';

export const GET: APIRoute = async ({ params }) => {
  try {
    const jobId = params.jobId;

    if (!jobId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Job ID is required.' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Query workflow status from orchestration API
    const workflowId = `file-processing-${jobId}`;
    const response = await fetch(`${ORCHESTRATION_API_URL}/workflows/${workflowId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      // If workflow not found, return a default status
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Job not found. It may have expired or never existed.' 
          }),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw new Error(`Workflow status query failed: ${response.statusText}`);
    }

    const workflowStatus = await response.json();
    
    // Transform workflow status to frontend job format
    const job = {
      id: jobId,
      workflowId: workflowId,
      status: workflowStatus.status || 'unknown',
      progress: workflowStatus.progress || 0,
      currentStep: workflowStatus.currentStep || 'Processing',
      originalFileName: workflowStatus.fileName || 'Unknown file',
      error: workflowStatus.error,
      result: workflowStatus.result
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        job
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

  } catch (error) {
    console.error('Status API error:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
