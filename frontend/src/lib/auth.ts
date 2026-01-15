import { Issuer, generators, type TokenSet, type UserinfoResponse } from "openid-client";
import type { Client } from "openid-client";

// Environment variables
const AUTHENTIK_ISSUER_URL = import.meta.env.AUTHENTIK_ISSUER_URL;
const AUTHENTIK_CLIENT_ID = import.meta.env.AUTHENTIK_CLIENT_ID;
const AUTHENTIK_CLIENT_SECRET = import.meta.env.AUTHENTIK_CLIENT_SECRET;
const PUBLIC_DOMAIN = import.meta.env.PUBLIC_DOMAIN || "localhost:4321";
const BASE_PATH = import.meta.env.PUBLIC_BASE_PATH || "";

// Construct the full callback URL
const getCallbackUrl = () => {
  const protocol = import.meta.env.NODE_ENV === "production" ? "https" : "https";
  return `${protocol}://${PUBLIC_DOMAIN}${BASE_PATH}/api/auth/callback`;
};

let cachedClient: Client | null = null;

/**
 * Get or create OIDC client
 */
export async function getOIDCClient(): Promise<Client> {
  if (cachedClient) {
    return cachedClient;
  }

  try {
    const issuer = await Issuer.discover(AUTHENTIK_ISSUER_URL);

    cachedClient = new issuer.Client({
      client_id: AUTHENTIK_CLIENT_ID,
      client_secret: AUTHENTIK_CLIENT_SECRET,
      redirect_uris: [getCallbackUrl()],
      response_types: ["code"],
    });

    return cachedClient;
  } catch (error) {
    console.error("Failed to initialize OIDC client:", error);
    throw new Error("Authentication service is not configured properly");
  }
}

/**
 * Generate authorization URL with PKCE
 */
export async function generateAuthorizationUrl(): Promise<{
  url: string;
  codeVerifier: string;
  state: string;
}> {
  const client = await getOIDCClient();

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();

  const url = client.authorizationUrl({
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return { url, codeVerifier, state };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenSet> {
  const client = await getOIDCClient();

  const tokenSet = await client.callback(redirectUri, { code }, { code_verifier: codeVerifier });

  return tokenSet;
}

/**
 * Get user info from token
 */
export async function getUserInfo(accessToken: string): Promise<UserinfoResponse> {
  const client = await getOIDCClient();
  return await client.userinfo(accessToken);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const client = await getOIDCClient();
  return await client.refresh(refreshToken);
}

/**
 * Revoke token (for logout)
 */
export async function revokeToken(
  token: string,
  tokenTypeHint: "access_token" | "refresh_token" = "access_token"
): Promise<void> {
  const client = await getOIDCClient();
  try {
    await client.revoke(token, tokenTypeHint);
  } catch (error) {
    // Token revocation errors are not critical for logout
    console.warn("Failed to revoke token:", error);
  }
}

/**
 * Get end session URL for logout
 */
export async function getEndSessionUrl(idToken?: string): Promise<string> {
  const client = await getOIDCClient();

  const protocol = import.meta.env.NODE_ENV === "production" ? "https" : "https";
  const postLogoutRedirectUri = `${protocol}://${PUBLIC_DOMAIN}${BASE_PATH}/`;

  return client.endSessionUrl({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
}
