import type { APIRoute } from "astro";
import { generateRequestId } from "@/lib/logger";
import { createErrorResponse, withLogging } from "@/lib/middleware";
import { ORCHESTRATION_API_URL } from "@/server-constants";

const downloadByDocHandler: APIRoute = async ({ params }) => {
  const requestId = generateRequestId();
  try {
    const { documentId, filename } = params;

    if (!documentId || !filename) {
      return createErrorResponse("Document ID and filename are required", {
        status: 400,
        requestId,
      });
    }

    // Redirect directly to the backend download URL to avoid binary data corruption
    const backendDownloadUrl = `${ORCHESTRATION_API_URL}/documents/download-by-doc/${documentId}/${filename}`;

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

export const GET = withLogging(downloadByDocHandler);

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
