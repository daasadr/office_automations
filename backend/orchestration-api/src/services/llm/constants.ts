/**
 * Required fields for waste document validation
 */
export const REQUIRED_FIELDS = [
  "Druh odpadu (katalogové číslo podle vyhlášky č. 8/2021 Sb.)",
  "Kategorie odpadu (O – ostatní, N – nebezpečný)",
  "Množství odpadu (v tunách nebo kg)",
  "Způsob nakládání (přeprava, předání, využití, odstranění)",
  "Datum vzniku nebo převzetí/předání odpadu",
  "Identifikace příjemce/předávající osoby (IČO, název, adresa)",
  "Přepravce odpadu (pokud je jiný než předávající nebo příjemce)",
  "Doklady spojené s odpadem (převodní listy, vážní lístky, smlouvy)",
  "Identifikační čísla zařízení (IČZ), kam byl odpad předán (pokud známé)",
] as const;
