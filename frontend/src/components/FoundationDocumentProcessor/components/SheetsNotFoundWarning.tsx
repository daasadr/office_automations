import { AlertTriangle } from "lucide-react";
import type { SheetNotFound } from "@/components/FoundationDocumentProcessor/types";

interface SheetsNotFoundWarningProps {
  sheetsNotFound?: SheetNotFound[];
}

export function SheetsNotFoundWarning({ sheetsNotFound }: SheetsNotFoundWarningProps) {
  if (!sheetsNotFound || sheetsNotFound.length === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-semibold text-orange-900 dark:text-orange-100 mb-2">
            Upozornění: Některé kódy odpadu nebyly nalezeny v zakládacím dokumentu
          </h4>
          <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
            Následující kombinace kódu odpadu a IČO nebyly nalezeny jako listy v zakládacím
            dokumentu. Systém se pokusil najít list s IČO odběratele i původce, ale žádný nebyl
            nalezen. Data pro tyto kódy nebyla přidána. Možná budete muset vytvořit nové listy nebo
            zkontrolovat názvy listů.
          </p>
          <div className="space-y-3">
            {sheetsNotFound.map((sheet, index) => (
              <div
                key={`${sheet.kodOdpadu}-${sheet.odberatelIco}-${index}`}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-800"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Kód odpadu:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono">
                      {sheet.kodOdpadu}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Název odpadu:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {sheet.nazevOdpadu || "—"}
                    </span>
                  </div>

                  {/* Odběratel info */}
                  <div className="md:col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Odběratel:</h5>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">IČO:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono">
                      {sheet.odberatelIco || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Název:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {sheet.odberatelNazev || "—"}
                    </span>
                  </div>

                  {/* Původce info */}
                  {(sheet.puvodceIco || sheet.puvodceNazev) && (
                    <>
                      <div className="md:col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                          Původce:
                        </h5>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">IČO:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-mono">
                          {sheet.puvodceIco || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Název:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {sheet.puvodceNazev || "—"}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Hledané názvy listů:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {sheet.targetSheetName}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-orange-800 dark:text-orange-200">
            <p className="font-medium">Doporučení:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Zkontrolujte, zda existují listy s těmito názvy v zakládacím dokumentu</li>
              <li>
                Ujistěte se, že názvy listů odpovídají formátu: "kód odpadu IČO" (např. "070213
                25638955")
              </li>
              <li>List může být pojmenován s IČO buď odběratele nebo původce odpadu</li>
              <li>Vytvořte chybějící listy a spusťte zpracování znovu</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
