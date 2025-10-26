import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "../../server-constants";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { foundationDocumentId, status } = body;

    if (!foundationDocumentId) {
      return new Response(JSON.stringify({ error: "Foundation document ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status. Must be 'approved' or 'rejected'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Forward request to orchestration API
    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/update-foundation-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ foundationDocumentId, status }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating foundation document status:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update foundation document status",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
