import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "@/server-constants";

export const GET: APIRoute = async ({ params }) => {
  const { jobId } = params;

  if (!jobId) {
    return new Response(JSON.stringify({ error: "Job ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(`${ORCHESTRATION_API_URL}/logistics/status/${jobId}`);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Logistics status error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get logistics status",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
