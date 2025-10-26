/**
 * Form Enhancement Utility
 *
 * Provides progressive enhancement for forms with better UX:
 * - Disables submit buttons during submission
 * - Shows loading state
 * - Automatic re-enable after timeout as failsafe
 */

interface EnhancedButton extends HTMLButtonElement {
  dataset: {
    loadingText?: string;
  };
}

/**
 * Extended button interface to track timeout IDs
 */
interface EnhancedButtonWithTimeout extends HTMLButtonElement {
  __enhancementTimeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Configuration for form enhancement
 */
export interface FormEnhancementConfig {
  /** Timeout in milliseconds before re-enabling the button (default: 30000) */
  failsafeTimeout?: number;
  /** Default loading text if not specified in data-loading-text attribute */
  defaultLoadingText?: string;
}

const DEFAULT_CONFIG: Required<FormEnhancementConfig> = {
  failsafeTimeout: 30000,
  defaultLoadingText: "Zpracování...",
};

/**
 * Enhance a single form with improved submission handling
 */
function enhanceForm(form: HTMLFormElement, config: Required<FormEnhancementConfig>): void {
  form.addEventListener("submit", function handleSubmit() {
    const submitButton = form.querySelector('button[type="submit"]') as EnhancedButton | null;

    if (!submitButton) {
      return;
    }

    // Disable button and store original state
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");

    const originalText = submitButton.textContent;
    const loadingText = submitButton.dataset?.loadingText || config.defaultLoadingText;
    submitButton.textContent = loadingText;

    // Re-enable after timeout as failsafe
    const timeoutId = setTimeout(() => {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      if (originalText) {
        submitButton.textContent = originalText;
      }
    }, config.failsafeTimeout);

    // Store timeout ID for potential cleanup
    (submitButton as EnhancedButtonWithTimeout).__enhancementTimeoutId = timeoutId;
  });
}

/**
 * Clean up any pending timeouts on a form
 */
function cleanupForm(form: HTMLFormElement): void {
  const submitButton = form.querySelector(
    'button[type="submit"]'
  ) as EnhancedButtonWithTimeout | null;
  if (submitButton?.__enhancementTimeoutId) {
    clearTimeout(submitButton.__enhancementTimeoutId);
    delete submitButton.__enhancementTimeoutId;
  }
}

/**
 * Initialize form enhancement for all forms with data-enhance attribute
 * Should be called when the page loads
 */
export function initializeFormEnhancement(config: FormEnhancementConfig = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  document.addEventListener("astro:page-load", () => {
    const forms = document.querySelectorAll("form[data-enhance]") as NodeListOf<HTMLFormElement>;

    forms.forEach((form) => {
      // Clean up any previous enhancement
      cleanupForm(form);

      // Apply enhancement
      enhanceForm(form, finalConfig);
    });
  });
}

/**
 * Manually enhance a specific form (useful for dynamically added forms)
 */
export function enhanceSpecificForm(
  form: HTMLFormElement,
  config: FormEnhancementConfig = {}
): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  cleanupForm(form);
  enhanceForm(form, finalConfig);
}
