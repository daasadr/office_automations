import { getIronSession, type IronSession } from "iron-session";
import type { AstroCookies } from "astro";

export interface SessionData {
  user?: {
    sub: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  isAuthenticated: boolean;
}

const sessionOptions = {
  password: import.meta.env.SESSION_SECRET || "complex_password_at_least_32_characters_long",
  cookieName: "auth_session",
  cookieOptions: {
    secure: import.meta.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

/**
 * Get session from Astro cookies
 * This works with both Request and AstroCookies
 */
export async function getSession(
  requestOrCookies: Request | AstroCookies
): Promise<IronSession<SessionData>> {
  if (requestOrCookies instanceof Request) {
    return getIronSession<SessionData>(requestOrCookies, new Response(), sessionOptions);
  } else {
    // Convert AstroCookies to Request-like object
    const cookieHeader = requestOrCookies.get(sessionOptions.cookieName);
    const headers = new Headers();
    if (cookieHeader?.value) {
      headers.set("cookie", `${sessionOptions.cookieName}=${cookieHeader.value}`);
    }
    const request = new Request("http://localhost", { headers });
    const response = new Response();
    return getIronSession<SessionData>(request, response, sessionOptions);
  }
}

/**
 * Create or update session with user data
 */
export async function createSession(
  request: Request,
  response: Response,
  data: Omit<SessionData, "isAuthenticated">
): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.user = data.user;
  session.accessToken = data.accessToken;
  session.refreshToken = data.refreshToken;
  session.idToken = data.idToken;
  session.expiresAt = data.expiresAt;
  session.isAuthenticated = true;
  await session.save();
  return session;
}

/**
 * Destroy session (logout)
 */
export async function destroySession(request: Request, response: Response): Promise<void> {
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.destroy();
}

/**
 * Check if session is valid and not expired
 */
export function isSessionValid(session: SessionData): boolean {
  if (!session.isAuthenticated || !session.user || !session.accessToken) {
    return false;
  }

  // Check if token is expired (with 5 minute buffer)
  if (session.expiresAt && session.expiresAt < Date.now() + 5 * 60 * 1000) {
    return false;
  }

  return true;
}
