import type { APIRoute } from "astro";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { getIronSession } from "iron-session";
import {
  createDirectus,
  rest,
  staticToken,
  readItems,
  updateItem,
  createItem,
} from "@directus/sdk";

/**
 * Handles the OIDC callback from Authentik
 * Exchanges authorization code for tokens and creates user session
 */
export const GET: APIRoute = async ({ request, redirect, url }) => {
  const searchParams = url.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error);
    return redirect(`/?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code) {
    return redirect("/?error=missing_code", 302);
  }

  try {
    // Retrieve PKCE parameters from session
    const sessionOptions = {
      password: import.meta.env.SESSION_SECRET || "complex_password_at_least_32_characters_long",
      cookieName: "auth_session",
      cookieOptions: {
        secure: import.meta.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      },
    };

    const response = new Response();
    const tempSession = await getIronSession(request, response, sessionOptions);
    const codeVerifier = (tempSession as any).codeVerifier;
    const storedState = (tempSession as any).state;

    // Verify state parameter to prevent CSRF
    if (state !== storedState) {
      console.error("State mismatch:", { received: state, expected: storedState });
      return redirect("/?error=invalid_state", 302);
    }

    if (!codeVerifier) {
      console.error("Missing code verifier in session");
      return redirect("/?error=missing_verifier", 302);
    }

    // Build redirect URI
    const protocol = import.meta.env.NODE_ENV === "production" ? "https" : "https";
    const domain = import.meta.env.PUBLIC_DOMAIN || "localhost:4321";
    const basePath = import.meta.env.PUBLIC_BASE_PATH || "";
    const redirectUri = `${protocol}://${domain}${basePath}/api/auth/callback`;

    // Exchange authorization code for tokens
    const tokenSet = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    // Get user information
    const userInfo = await getUserInfo(tokenSet.access_token!);

    // Calculate token expiration
    const expiresAt = tokenSet.expires_at ? tokenSet.expires_at * 1000 : Date.now() + 3600 * 1000;

    // Create session
    await createSession(request, response, {
      user: {
        sub: userInfo.sub,
        email: userInfo.email || "",
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture,
      },
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
      expiresAt,
    });

    // Sync user to Directus
    try {
      await syncUserToDirectus(userInfo);
    } catch (error) {
      console.error("Failed to sync user to Directus:", error);
      // Don't fail the login if Directus sync fails
    }

    // Copy response headers (including session cookie) to redirect response
    const headers = new Headers(response.headers);

    // Redirect to home page after successful login
    return new Response(null, {
      status: 302,
      headers: {
        ...Object.fromEntries(headers.entries()),
        Location: "/",
      },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return redirect(
      `/?error=${encodeURIComponent(error instanceof Error ? error.message : "authentication_failed")}`,
      302
    );
  }
};

/**
 * Sync user to Directus
 * Creates or updates user record in Directus based on OIDC user info
 */
async function syncUserToDirectus(userInfo: any): Promise<void> {
  const directusUrl = import.meta.env.DIRECTUS_URL;
  const directusToken = import.meta.env.DIRECTUS_TOKEN;

  if (!directusUrl || !directusToken) {
    console.warn("Directus credentials not configured, skipping user sync");
    return;
  }

  try {
    const directus = createDirectus(directusUrl).with(rest()).with(staticToken(directusToken));

    // Check if user exists by email
    const existingUsers = await directus.request(
      readItems("directus_users", {
        filter: { email: { _eq: userInfo.email } },
        limit: 1,
      })
    );

    const now = new Date().toISOString();

    if (existingUsers && existingUsers.length > 0) {
      // Update existing user
      const userId = existingUsers[0].id;
      await directus.request(
        updateItem("directus_users", userId, {
          first_name: userInfo.given_name || userInfo.name?.split(" ")[0] || null,
          last_name: userInfo.family_name || userInfo.name?.split(" ").slice(1).join(" ") || null,
          last_access: now,
          // Update external identifier if it changed
          external_identifier: userInfo.sub,
        })
      );
      console.log(`Updated Directus user: ${userInfo.email}`);
    } else {
      // Create new user
      await directus.request(
        createItem("directus_users", {
          email: userInfo.email,
          first_name: userInfo.given_name || userInfo.name?.split(" ")[0] || null,
          last_name: userInfo.family_name || userInfo.name?.split(" ").slice(1).join(" ") || null,
          status: "active",
          provider: "authentik",
          external_identifier: userInfo.sub,
          role: null, // Will use default role
        })
      );
      console.log(`Created new Directus user: ${userInfo.email}`);
    }
  } catch (error) {
    console.error("Directus sync error:", error);
    throw error;
  }
}
