/**
 * TypeScript definitions for LLM response schema
 * Used for waste management data extraction
 */

/**
 * Samostatná provozovna (Independent establishment)
 */
export interface SamostatnaProv {
  "číslo provozovny": string;
  název: string;
  adresa: string;
  "zodpovědná osoba": string | null;
}

/**
 * Původce odpadu (Waste originator)
 */
export interface Puvod {
  IČO: string;
  název: string;
  adresa: string;
  "zodpovědná osoba": string | null;
  // Support multiple field name variations from different LLM responses
  "SAMOSTATNÁ PROVOZOVNA"?: SamostatnaProv | null;
  "samostatná provozovna"?: SamostatnaProv | null;
  samostatna_provozovna?: SamostatnaProv | null;
}

/**
 * Odběratel odpadu (Waste recipient)
 */
export interface Odberatel {
  IČO: string;
  název: string;
  adresa: string;
  // Support multiple field name variations from different LLM responses
  "samostatná provozovna"?: SamostatnaProv | null;
  samostatna_provozovna?: SamostatnaProv | null;
}

/**
 * Tabulka záznam (Table record)
 */
export interface TabulkaRecord {
  "pořadové číslo": number;
  "datum vzniku": string;
  // Use number type for quantities (without units like "t" or "kg")
  "množství vzniklého odpadu": number | null;
  "množství předaného odpadu": number | null;
}

/**
 * Extrahovaná data (Extracted data)
 */
export interface ExtractedData {
  "kód odpadu": string;
  "název/druh odpadu": string;
  "kategorie odpadu": string | null;
  "kód způsobu nakládání": string | null;
  původce: Puvod;
  odběratel: Odberatel;
  tabulka: TabulkaRecord[];
}

/**
 * Hlavní LLM odpověď schéma (Main LLM response schema)
 */
export interface LLMResponseSchema {
  /**
   * Seznam přítomných polí v dokumentu
   */
  present: string[];

  /**
   * Seznam chybějících polí v dokumentu
   */
  missing: string[];

  /**
   * Míra jistoty extrakce (0-100)
   */
  confidence: number;

  /**
   * Pole extrahovaných dat o odpadu
   */
  extracted_data: ExtractedData[];
}
