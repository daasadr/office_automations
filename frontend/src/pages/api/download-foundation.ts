import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "@/server-constants";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { foundationDocumentId } = body;

    if (!foundationDocumentId) {
      return new Response(JSON.stringify({ error: "Foundation document ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Forward request to orchestration API
    const response = await fetch(
      `${ORCHESTRATION_API_URL}/documents/download-foundation/${foundationDocumentId}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the file buffer
    const buffer = await response.arrayBuffer();

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "foundation_document.xlsx";
    if (contentDisposition) {
      const matches = /filename="(.+)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }

    // Return the file
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error downloading foundation document:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to download foundation document",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
