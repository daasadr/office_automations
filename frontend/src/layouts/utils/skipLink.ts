/**
 * Skip Link Utility
 *
 * Provides accessibility skip link functionality for keyboard navigation.
 * This allows users to skip directly to the main content.
 */

/**
 * Initialize skip link behavior
 * Ensures the skip link works correctly and focuses the main content when activated
 */
export function initializeSkipLink(): void {
  document.addEventListener("DOMContentLoaded", () => {
    const skipLink = document.querySelector(".skip-link") as HTMLAnchorElement;
    const mainContent = document.querySelector("#main-content") as HTMLElement;

    if (skipLink && mainContent) {
      skipLink.addEventListener("click", (e) => {
        e.preventDefault();

        // Ensure main content is focusable
        if (!mainContent.hasAttribute("tabindex")) {
          mainContent.setAttribute("tabindex", "-1");
        }

        // Focus the main content
        mainContent.focus();

        // Remove tabindex after focus to maintain natural tab order
        mainContent.addEventListener(
          "blur",
          () => {
            mainContent.removeAttribute("tabindex");
          },
          { once: true }
        );
      });
    }
  });
}
