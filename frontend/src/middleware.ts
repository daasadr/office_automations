import type { MiddlewareHandler } from "astro";
import { getSession, isSessionValid } from "./lib/session";

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES: string[] = [
  // "/kvalita",
  // "/logistika",
  // "/settings",
];

/**
 * Routes that are always public (no auth required)
 */
const PUBLIC_ROUTES = ["/api/auth", "/api/health"];

/**
 * Check if a path matches any pattern in the list
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname.startsWith(route));
}

/**
 * Middleware for base path access control and authentication
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
  const basePath = import.meta.env.PUBLIC_BASE_PATH || "";
  const url = new URL(context.request.url);
  let pathname = url.pathname;

  // Base path handling
  if (basePath) {
    const normalizedBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

    // If accessing exactly the base path without trailing slash, redirect to with trailing slash
    if (pathname === normalizedBasePath) {
      return context.redirect(`${normalizedBasePath}/`, 301);
    }

    // Block requests that don't start with the base path
    if (!pathname.startsWith(`${normalizedBasePath}/`)) {
      return new Response(`<div><h1>404 - Page not found</h1></div>`, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // Remove base path for route matching
    pathname = pathname.substring(normalizedBasePath.length);
  }

  // Skip auth for public routes
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return next();
  }

  // Check if route requires authentication
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    try {
      const session = await getSession(context.cookies);

      // Check if session is valid
      if (!isSessionValid(session)) {
        // Store the original URL to redirect back after login
        const returnUrl = encodeURIComponent(url.pathname + url.search);
        const loginUrl = basePath
          ? `${basePath}/api/auth/login?return=${returnUrl}`
          : `/api/auth/login?return=${returnUrl}`;
        return context.redirect(loginUrl, 302);
      }

      // User is authenticated, continue to the page
      return next();
    } catch (error) {
      console.error("Authentication middleware error:", error);
      // On error, redirect to login
      const loginUrl = basePath ? `${basePath}/api/auth/login` : `/api/auth/login`;
      return context.redirect(loginUrl, 302);
    }
  }

  // All other routes are accessible without authentication
  return next();
};
