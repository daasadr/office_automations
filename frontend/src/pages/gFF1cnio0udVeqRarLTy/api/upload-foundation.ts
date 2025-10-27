import type { APIRoute } from "astro";
import { ORCHESTRATION_API_URL } from "@/server-constants";

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get the form data from the request
    const formData = await request.formData();

    // Forward the form data to orchestration API
    const response = await fetch(`${ORCHESTRATION_API_URL}/documents/upload-foundation`, {
      method: "POST",
      body: formData,
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
    console.error("Upload foundation document error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to upload foundation document",
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
