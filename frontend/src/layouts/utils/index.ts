/**
 * Layout Utilities Index
 *
 * Central export point for all layout utility functions
 */

import { initializeViewTransitions, hasViewTransitionsSupport } from "./viewTransitions";
import { initializeFormEnhancement, enhanceSpecificForm } from "./formEnhancement";
import { initializeSkipLink } from "./skipLink";

// Re-export all utilities
export {
  initializeViewTransitions,
  hasViewTransitionsSupport,
} from "./viewTransitions";
export {
  initializeFormEnhancement,
  enhanceSpecificForm,
} from "./formEnhancement";
export { initializeSkipLink } from "./skipLink";
export type { FormEnhancementConfig } from "./formEnhancement";

/**
 * Initialize all layout utilities at once
 * Call this function once when the page loads to enable all enhancements
 */
export function initializeLayoutUtils(): void {
  initializeViewTransitions();
  initializeFormEnhancement();
  initializeSkipLink();
}
