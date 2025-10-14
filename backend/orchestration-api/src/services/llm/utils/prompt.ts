import { REQUIRED_FIELDS } from "../constants";

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
- tabulku se sloupci: pořadové číslo, datum vzniku, množství vznikého odpadu, množství předaného odpadu

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu:
{"present": ["seznam nalezených typů informací"], "missing": ["seznam chybějících typů informací"], "extracted_data": [...]}

Kontrolované typy informací:
${REQUIRED_FIELDS.map((field, index) => `${index + 1}. ${field}`).join("\n")}`;
}
