/**
 * View Transitions Utility
 *
 * Provides progressive enhancement for page transitions using the View Transitions API
 * with fallback animations for browsers that don't support it.
 */

/**
 * Check if the browser supports the View Transitions API
 */
export function hasViewTransitionsSupport(): boolean {
  return "startViewTransition" in document;
}

/**
 * Apply fallback slide-in animation for older browsers
 */
function applyFallbackAnimation(): void {
  const content = document.querySelector(".page-content") as HTMLElement;
  if (content) {
    content.style.animation = "slideIn 0.3s ease-out";
  }
}

/**
 * Initialize view transitions based on browser support
 * Should be called when the page loads
 */
export function initializeViewTransitions(): void {
  if (hasViewTransitionsSupport()) {
    // Modern browsers with native view transitions
    document.addEventListener("astro:page-load", () => {
      // View transitions are handled natively, no additional setup needed
    });
  } else {
    // Fallback for older browsers
    document.addEventListener("astro:page-load", applyFallbackAnimation);
  }
}
