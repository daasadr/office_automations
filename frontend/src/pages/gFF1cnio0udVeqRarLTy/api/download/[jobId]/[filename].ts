import type { APIRoute } from "astro";
import { withLogging, createErrorResponse, loggedFetch } from "@/lib/middleware";
import { generateRequestId } from "@/lib/logger";
import { ORCHESTRATION_API_URL } from "@/server-constants";

const downloadHandler: APIRoute = async ({ params }) => {
  const requestId = generateRequestId();
  try {
    const { jobId, filename } = params;

    if (!jobId || !filename) {
      return createErrorResponse("Job ID and filename are required", { status: 400, requestId });
    }

    // Redirect directly to the backend download URL to avoid binary data corruption
    const backendDownloadUrl = `${ORCHESTRATION_API_URL}/documents/download/${jobId}/${filename}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: backendDownloadUrl,
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    return createErrorResponse("Internal server error. Please try again later.", {
      status: 500,
      requestId,
    });
  }
};

export const GET = withLogging(downloadHandler);

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
