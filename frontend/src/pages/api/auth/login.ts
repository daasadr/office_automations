import type { APIRoute } from "astro";
import { generateAuthorizationUrl } from "@/lib/auth";
import { getSession } from "@/lib/session";

/**
 * Initiates the OIDC login flow
 * Generates authorization URL and stores PKCE verifier in session
 */
export const GET: APIRoute = async ({ request, redirect, cookies }) => {
  try {
    // Check if user is already authenticated
    const session = await getSession(cookies);
    if (session.isAuthenticated && session.user) {
      // Already logged in, redirect to home
      return redirect("/", 302);
    }

    // Generate authorization URL with PKCE
    const { url, codeVerifier, state } = await generateAuthorizationUrl();

    // Store PKCE parameters in session for callback verification
    const tempSession = await getSession(request);
    (tempSession as any).codeVerifier = codeVerifier;
    (tempSession as any).state = state;
    await tempSession.save();

    // Redirect to Authentik login page
    return redirect(url, 302);
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to initiate login",
        message: error instanceof Error ? error.message : "Unknown error",
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
