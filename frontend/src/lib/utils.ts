import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_PATH } from "@/client-constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Adds the base path to a URL path
 * @param path - The path to add the base path to (should start with /)
 * @returns The full path with base path prepended
 */
export function withBasePath(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // If no base path, return the normalized path
  if (!BASE_PATH) {
    return normalizedPath;
  }

  // Ensure BASE_PATH doesn't end with / and starts with /
  const normalizedBasePath = BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`;
  const cleanBasePath = normalizedBasePath.endsWith("/")
    ? normalizedBasePath.slice(0, -1)
    : normalizedBasePath;

  return `${cleanBasePath}${normalizedPath}`;
}

/**
 * Generates a URL with query parameters and base path
 * @param path - The base path
 * @param params - Optional query parameters
 * @returns The full URL with base path and query parameters
 */
export function generateUrl(path: string, params?: Record<string, string | undefined>): string {
  const fullPath = withBasePath(path);

  if (!params) {
    return fullPath;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${fullPath}?${queryString}` : fullPath;
}
