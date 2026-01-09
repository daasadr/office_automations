import type { APIRoute } from "astro";
import { getEndSessionUrl, revokeToken } from "@/lib/auth";
import { destroySession, getSession } from "@/lib/session";

/**
 * Handles user logout
 * Revokes tokens, destroys session, and redirects to Authentik logout
 */
export const GET: APIRoute = async ({ request, redirect, cookies }) => {
  try {
    // Get current session
    const session = await getSession(cookies);

    // Revoke tokens if they exist
    if (session.accessToken) {
      try {
        await revokeToken(session.accessToken, "access_token");
      } catch (error) {
        console.warn("Failed to revoke access token:", error);
      }
    }

    if (session.refreshToken) {
      try {
        await revokeToken(session.refreshToken, "refresh_token");
      } catch (error) {
        console.warn("Failed to revoke refresh token:", error);
      }
    }

    // Get Authentik logout URL
    const logoutUrl = await getEndSessionUrl(session.idToken);

    // Destroy session
    const response = new Response();
    await destroySession(request, response);

    // Redirect to Authentik logout (which will redirect back to home page)
    return new Response(null, {
      status: 302,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        Location: logoutUrl,
      },
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Even if logout fails, redirect to home
    return redirect("/", 302);
  }
};
