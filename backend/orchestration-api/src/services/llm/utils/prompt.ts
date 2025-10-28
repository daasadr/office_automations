import { REQUIRED_FIELDS } from "@orchestration-api/services/llm/constants";

/**
 * Creates the prompt for Gemini PDF analysis
 * commented out:
 * množství předaného odpadu
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
- tabulku se sloupci: pořadové číslo, datum vzniku, množství odpadu (extrahuj toto množství pod nazvem pole "množství vzniklého odpadu")

DŮLEŽITÉ PRO MNOŽSTVÍ:
- Extrahuj množství jako ČISTÉ ČÍSLO (float) BEZ jednotek (t, kg, tun)
- Například "2,05 t" nebo "2.05 t" musí být extrahováno jako 2.05
- Používej tečku jako oddělovač desetinných míst (ne čárku)
- Pokud je množství uvedeno v kg a ostatní jsou v tunách, převeď na stejnou jednotku (tuny)

Při získávání informací z tabulky ber v potaz i ten fakt, že někdy dva řádky tabulky odpovídají jedné položce v poli extracted_data. Například dokument může obsahovat dva řádky jeden pro příjem a druhý pro zpracování. Reálně je to možné brát jako jeden řádek (extrahuj toto množství pod nazvem pole "množství vzniklého odpadu").
Dokument může být také ve formě faktury, né jenom přehledu/výpisu. V takovém případě hledej výše uvedené informace v kontextu fakturačních údajů - množství odpadu může být uvedeno jako fakturované množství (extrahuj toto množství pod polem "množství vzniklého odpadu").

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu:
{"present": ["seznam nalezených typů informací"], "missing": ["seznam chybějících typů informací"], "extracted_data": [...]}

Kontrolované typy informací:
${REQUIRED_FIELDS.map((field, index) => `${index + 1}. ${field}`).join("\n")}`;
}
