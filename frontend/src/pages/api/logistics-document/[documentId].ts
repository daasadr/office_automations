import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "@/server-constants";

export const GET: APIRoute = async ({ params }) => {
  const { documentId } = params;

  if (!documentId) {
    return new Response(JSON.stringify({ error: "Document ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(`${ORCHESTRATION_API_URL}/logistics/document/${documentId}`);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Logistics document fetch error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch logistics document",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
