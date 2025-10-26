import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "../../server-constants";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { jobId, responseId, sourceDocumentId } = body;

    if (!jobId && !responseId && !sourceDocumentId) {
      return new Response(
        JSON.stringify({
          error: "Either jobId, responseId, or sourceDocumentId is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Forward request to orchestration API
    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/process-foundation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId, responseId, sourceDocumentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Process foundation error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process foundation document",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
