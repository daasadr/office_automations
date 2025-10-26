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
    "samostatná provozovna"?: {
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
  };
  tabulka?: Array<{
    "pořadové číslo"?: string;
    "datum vzniku"?: string;
    "množství vznikého odpadu"?: string;
    "množství předaného odpadu"?: string;
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
