/**
 * LLM Constants
 *
 * This file re-exports field constants from the prompts module for backwards compatibility.
 * For new code, prefer importing directly from the prompts module.
 */
export { WASTE_REQUIRED_FIELDS, LOGISTICS_REQUIRED_FIELDS } from "./prompts";

/**
 * @deprecated Use WASTE_REQUIRED_FIELDS or import from prompts module directly
 */
export { WASTE_REQUIRED_FIELDS as REQUIRED_FIELDS } from "./prompts";
