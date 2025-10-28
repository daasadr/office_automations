export interface ExtractedDataRecord {
  "kód odpadu"?: string;
  "název/druh odpadu"?: string;
  "kategorie odpadu"?: string | null;
  "kód způsobu nakládání"?: string | null;
  původce?: {
    IČO?: string;
    název?: string;
    adresa?: string;
    "zodpovědná osoba"?: string;
    // Support multiple field name variations
    "SAMOSTATNÁ PROVOZOVNA"?: {
      "číslo provozovny"?: string;
      název?: string;
      adresa?: string;
      "zodpovědná osoba"?: string;
    };
    "samostatná provozovna"?: {
      "číslo provozovny"?: string;
      název?: string;
      adresa?: string;
      "zodpovědná osoba"?: string;
    };
    samostatna_provozovna?: {
      "číslo provozovny"?: string;
      název?: string;
      adresa?: string;
      "zodpovědná osoba"?: string;
    };
  };
  odběratel?: {
    IČO?: string;
    název?: string;
    adresa?: string;
    // Support multiple field name variations
    "samostatná provozovna"?: {
      "číslo provozovny"?: string;
      název?: string;
      adresa?: string;
      "zodpovědná osoba"?: string;
    };
    samostatna_provozovna?: {
      "číslo provozovny"?: string;
      název?: string;
      adresa?: string;
      "zodpovědná osoba"?: string;
    };
  };
  tabulka?: Array<{
    "pořadové číslo"?: string | number;
    "datum vzniku"?: string;
    // Fixed typo: should be "vzniklého" not "vznikého"
    "množství vzniklého odpadu"?: string | number;
    "množství předaného odpadu"?: string | number;
  }>;
}

export interface ValidationData {
  validationResult: {
    present: string[];
    missing: string[];
    confidence: number;
    extracted_data?: ExtractedDataRecord[];
  };
  directusSourceDocumentId?: string;
  status?: string;
}

export interface ValidationStatusPollerProps {
  documentId?: string;
  jobId?: string;
}
