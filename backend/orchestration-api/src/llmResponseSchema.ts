/**
 * TypeScript definitions for LLM response schema
 * Used for waste management data extraction
 */

/**
 * Independent establishment (Samostatná provozovna)
 */
export interface IndependentEstablishment {
  establishment_number: string | null;
  name: string | null;
  address: string | null;
  responsible_person: string | null;
}

/**
 * Waste originator (Původce odpadu)
 */
export interface WasteOriginator {
  company_id: string;
  name: string;
  address: string;
  responsible_person: string | null;
  independent_establishment?: IndependentEstablishment | null;
}

/**
 * Waste recipient (Odběratel odpadu)
 */
export interface WasteRecipient {
  company_id: string;
  name: string;
  address: string;
  independent_establishment?: IndependentEstablishment | null;
}

/**
 * Waste record (Záznam o odpadu)
 */
export interface WasteRecord {
  serial_number: number;
  date: string;
  // Use number type for quantities (without units like "t" or "kg")
  waste_amount_generated: number | null;
  waste_amount_transferred?: number | null;
}

/**
 * Extracted waste data (Extrahovaná data o odpadu)
 */
export interface ExtractedWasteData {
  waste_code: string;
  waste_name: string;
  waste_category: string | null;
  handling_code: string | null;
  originator: WasteOriginator;
  recipient: WasteRecipient;
  records: WasteRecord[];
}

/**
 * Main LLM response schema (Hlavní LLM odpověď schéma)
 */
export interface LLMResponseSchema {
  /**
   * List of fields present in the document
   */
  present_fields: string[];

  /**
   * List of fields missing from the document
   */
  missing_fields: string[];

  /**
   * Extraction confidence score (0-100)
   */
  confidence: number;

  /**
   * Array of extracted waste data
   */
  extracted_data: ExtractedWasteData[];
}

/**
 * Legacy type alias for backward compatibility
 */
export type ExtractedData = ExtractedWasteData;
