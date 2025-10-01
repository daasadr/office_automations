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
