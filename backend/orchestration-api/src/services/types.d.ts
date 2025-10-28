export interface ExtractedData {
  "kód odpadu"?: string;
  "název/druh odpadu"?: string;
  "kategorie odpadu"?: string;
  "kód způsobu nakládání"?: string;
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
