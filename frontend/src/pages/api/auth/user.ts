import type { APIRoute } from "astro";
import { getSession, isSessionValid } from "@/lib/session";

/**
 * Returns current user information from session
 */
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const session = await getSession(cookies);

    if (!isSessionValid(session)) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          user: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        user: session.user,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Failed to get user info:", error);
    return new Response(
      JSON.stringify({
        authenticated: false,
        user: null,
        error: "Failed to retrieve user information",
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
