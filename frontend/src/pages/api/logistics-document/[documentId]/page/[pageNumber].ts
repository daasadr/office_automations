import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "@/server-constants";

export const GET: APIRoute = async ({ params }) => {
  const { documentId, pageNumber } = params;

  if (!documentId) {
    return new Response(JSON.stringify({ error: "Document ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!pageNumber) {
    return new Response(JSON.stringify({ error: "Page number is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate page number
  const pageNum = Number.parseInt(pageNumber, 10);
  if (Number.isNaN(pageNum) || pageNum < 1) {
    return new Response(JSON.stringify({ error: "Invalid page number" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      `${ORCHESTRATION_API_URL}/logistics/document/${documentId}/page/${pageNumber}`
    );

    if (!response.ok) {
      // Forward error responses from backend
      const errorData = await response.json();
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the PDF buffer from the backend response
    const pdfBuffer = await response.arrayBuffer();

    // Forward the PDF with appropriate headers
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="document-page-${pageNumber}.pdf"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Page extraction error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to extract page",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
