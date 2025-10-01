import type { APIRoute } from "astro";
import { withLogging, createErrorResponse, loggedFetch, RequestTimer } from "../../lib/middleware";
import { generateRequestId } from "../../lib/logger";
import { ORCHESTRATION_API_URL, CONTENT_TYPE_JSON } from "../../constants";

const generateExcelHandler: APIRoute = async ({ request }) => {
  const requestId = generateRequestId();
  const timer = new RequestTimer();

  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return createErrorResponse("Job ID is required", { status: 400, requestId });
    }

    // Forward the request to the backend orchestration API to generate Excel
    const backendResponse = await loggedFetch(`${ORCHESTRATION_API_URL}/documents/generate-excel`, {
      method: "POST",
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
      },
      body: JSON.stringify({ jobId }),
      requestId,
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse
        .json()
        .catch(() => ({ error: "Backend request failed" }));
      return createErrorResponse(errorData.error || "Failed to generate Excel file", {
        status: backendResponse.status,
        requestId,
        details: errorData.details,
      });
    }

    // Excel file was generated successfully on backend
    // Extract filename from Content-Disposition header
    const contentDisposition = backendResponse.headers.get("Content-Disposition");
    const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || `odpady_${jobId}.xlsx`;

    // Return JSON response with download URL pointing to frontend proxy
    const downloadUrl = `/api/download/${jobId}/${filename}`;

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        downloadUrl,
        requestId,
        message: "Excel file generated successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": CONTENT_TYPE_JSON,
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    return createErrorResponse("Failed to generate Excel file", {
      status: 500,
      requestId,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const POST = withLogging(generateExcelHandler);
