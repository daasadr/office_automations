import { REQUIRED_FIELDS } from "@orchestration-api/services/llm/constants";

/**
 * Creates the prompt for Gemini PDF analysis
 */
export function createAnalysisPrompt(): string {
  return `Zkontroluj prosím tento PDF dokument průběžné evidence odpadů a urči, které z následujících informací obsahuje a které chybí.

DŮLEŽITÉ: Analyzuj všechny stránky v dokumentu - informace se mohou nacházet na jakékoli stránce. Dokument může obsahovat tabulky s mnoha řádky dat.

Vyextrahuj z toho dokumentu pro každý kód odpadu (do extracted_data pole vytvoř samostatný objekt):
- kód odpadu (katalogové číslo)
- název/druh odpadu
- kategorie odpadu
- kód způsobu nakládání
- původce - IČO, název, adresa, zodpovědná osoba. pokud možno pak také SAMOSTATNÁ PROVOZOVNA (číslo provozovny, název, adresa, zodpovědná osoba)
- odběratel - IČO, název, adresa
- tabulku se sloupci: pořadové číslo, datum vzniku, množství odpadu (extrahuj toto množství pod nazvem pole "waste_amount_generated")

DŮLEŽITÉ PRO MNOŽSTVÍ:
- Extrahuj množství jako ČISTÉ ČÍSLO (float) BEZ jednotek (t, kg, tun)
- Například "2,05 t" nebo "2.05 t" musí být extrahováno jako 2.05
- Používej tečku jako oddělovač desetinných míst (ne čárku)
- Pokud je množství uvedeno v kg a ostatní jsou v tunách, převeď na stejnou jednotku (tuny)

Při získávání informací z tabulky ber v potaz i ten fakt, že někdy dva řádky tabulky odpovídají jedné položce v poli extracted_data. Například dokument může obsahovat dva řádky jeden pro příjem a druhý pro zpracování. Reálně je to možné brát jako jeden řádek (extrahuj toto množství pod nazvem pole "waste_amount_generated").
Dokument může být také ve formě faktury, né jenom přehledu/výpisu. V takovém případě hledej výše uvedené informace v kontextu fakturačních údajů - množství odpadu může být uvedeno jako fakturované množství (extrahuj toto množství pod polem "waste_amount_generated").

MAPOVÁNÍ KLÍČŮ - Použij tyto anglické klíče pro následující české informace:
- "waste_code" = kód odpadu (katalogové číslo)
- "waste_name" = název/druh odpadu
- "waste_category" = kategorie odpadu (O - ostatní, N - nebezpečný)
- "handling_code" = kód způsobu nakládání
- "originator" = původce odpadu
  - "company_id" = IČO
  - "name" = název
  - "address" = adresa
  - "responsible_person" = zodpovědná osoba
  - "independent_establishment" = samostatná provozovna
    - "establishment_number" = číslo provozovny
    - "name" = název provozovny
    - "address" = adresa provozovny
    - "responsible_person" = zodpovědná osoba provozovny
- "recipient" = odběratel odpadu
  - "company_id" = IČO
  - "name" = název
  - "address" = adresa
  - "independent_establishment" = samostatná provozovna (pokud existuje)
- "records" = tabulka záznamů
  - "serial_number" = pořadové číslo
  - "date" = datum vzniku
  - "waste_amount_generated" = množství vzniklého odpadu
  - "waste_amount_transferred" = množství předaného odpadu

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu.
Použij PŘESNĚ následující strukturu s anglickými klíči a podtržítky:

{
  "present_fields": ["seznam nalezených typů informací"],
  "missing_fields": ["seznam chybějících typů informací"],
  "confidence": 75.5,
  "extracted_data": [
    {
      "waste_code": "170405",
      "waste_name": "Železo a ocel",
      "waste_category": "O",
      "handling_code": "AN3",
      "originator": {
        "company_id": "46900098",
        "name": "SPUR a.s.",
        "address": "třída Tomáše Bati 299, 76302 Zlín",
        "responsible_person": "Jan Novák",
        "independent_establishment": {
          "establishment_number": "1008729281",
          "name": "provoz ZLÍN",
          "address": "Malotova 7038, 76001 Zlín",
          "responsible_person": null
        }
      },
      "recipient": {
        "company_id": "46901094",
        "name": "METALŠROT Tlumačov a.s.",
        "address": "Mánesova 510, 763 62 Tlumačov",
        "independent_establishment": null
      },
      "records": [
        {
          "serial_number": 1,
          "date": "16.01.2025",
          "waste_amount_generated": 2.05,
          "waste_amount_transferred": null
        }
      ]
    }
  ]
}

DŮLEŽITÉ: 
- Všechny klíče musí být v angličtině s podtržítky (např. "waste_code", "company_id", "serial_number")
- Pole "independent_establishment" může být null pokud není v dokumentu
- Pole "waste_amount_transferred" může být null (momentálně se nepoužívá)
- Množství musí být číslo (float), ne string

Kontrolované typy informací:
${REQUIRED_FIELDS.map((field, index) => `${index + 1}. ${field}`).join("\n")}`;
}
