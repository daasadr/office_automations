import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "@/server-constants";

export const GET: APIRoute = async () => {
  try {
    // Forward request to orchestration API
    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/list-foundation`, {
      method: "GET",
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
    console.error("List foundation documents error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve foundation documents",
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
