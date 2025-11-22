import type { MiddlewareHandler } from "astro";

/**
 * Middleware to enforce base path access control
 *
 * When PUBLIC_BASE_PATH is set, this middleware ensures that:
 * 1. Only requests under the base path are allowed
 * 2. Requests to the root or other paths return 404
 * 3. The base path itself (without trailing slash) redirects to base path with slash
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
  const basePath = import.meta.env.PUBLIC_BASE_PATH || "";

  // If no base path is set, allow all requests
  if (!basePath) {
    return next();
  }

  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Normalize base path (ensure it doesn't end with /)
  const normalizedBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  // If accessing exactly the base path without trailing slash, redirect to with trailing slash
  if (pathname === normalizedBasePath) {
    return context.redirect(`${normalizedBasePath}/`, 301);
  }

  // Allow requests that start with the base path followed by /
  if (pathname.startsWith(`${normalizedBasePath}/`)) {
    return next();
  }

  // Block all other requests with custom 404 response
  return new Response(`<div><h1>404 - Page not found</h1></div>`, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
};
