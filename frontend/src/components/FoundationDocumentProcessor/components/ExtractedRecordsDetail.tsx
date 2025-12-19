import type {
  DuplicateRecord,
  ExtractedRecordDetail,
} from "@/components/FoundationDocumentProcessor/types";
import { cn } from "@/lib/utils";

interface ExtractedRecordsDetailProps {
  extractedRecords?: ExtractedRecordDetail[];
  duplicatesSkipped?: DuplicateRecord[];
}

export function ExtractedRecordsDetail({
  extractedRecords,
  duplicatesSkipped,
}: ExtractedRecordsDetailProps) {
  if (!extractedRecords || extractedRecords.length === 0) {
    return null;
  }

  // Helper function to check if a record is a duplicate
  const isDuplicateRecord = (date: string, amount: string, sheetName: string): boolean => {
    if (!duplicatesSkipped || duplicatesSkipped.length === 0) return false;

    return duplicatesSkipped.some(
      (dup) => dup.sheetName === sheetName && dup.date === date && dup.wasteAmount === amount
    );
  };

  // Mark records as duplicates
  const enrichedRecords = extractedRecords.map((detail) => ({
    ...detail,
    records: detail.records.map((record) => ({
      ...record,
      isDuplicate: isDuplicateRecord(
        record.datumVzniku,
        record.mnozstviVznikleho || record.mnozstviPredaneho,
        detail.sheetName
      ),
    })),
  }));

  const totalRecords = enrichedRecords.reduce((sum, detail) => sum + detail.records.length, 0);
  const totalDuplicates = duplicatesSkipped?.length || 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Detaily zpracování - Extrahované záznamy
        </h3>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {enrichedRecords.length}{" "}
            {enrichedRecords.length === 1
              ? "typ odpadu"
              : enrichedRecords.length < 5
                ? "typy odpadu"
                : "typů odpadu"}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            {totalRecords}{" "}
            {totalRecords === 1 ? "záznam" : totalRecords < 5 ? "záznamy" : "záznamů"} celkem
          </span>
          {totalDuplicates > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              {totalDuplicates}{" "}
              {totalDuplicates === 1
                ? "duplikát přeskočen"
                : totalDuplicates < 5
                  ? "duplikáty přeskočeny"
                  : "duplikátů přeskočeno"}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Níže jsou uvedeny všechny jednotlivé záznamy nalezené v nahraném dokumentu a informace o
        tom, do kterého listu byly přidány.
        {/* {totalDuplicates > 0 && (
          <span className="block mt-2 text-orange-700 dark:text-orange-300">
            ⚠️ Záznamy označené oranžově s přeškrtnutím byly přeskočeny jako duplikáty (již existují
            v dokumentu).
          </span>
        )} */}
      </p>

      <div className="space-y-6">
        {enrichedRecords.map((detail) => (
          <div
            key={`${detail.sheetName}-${detail.kodOdpadu}`}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
          >
            {/* Sheet Header */}
            <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    List: {detail.sheetName}
                  </h4>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Kód odpadu:</span> {detail.kodOdpadu}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Název odpadu:</span> {detail.nazevOdpadu}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Odběratel:</span> {detail.odberatel.nazev} (IČO:{" "}
                      {detail.odberatel.ico})
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {detail.records.length}{" "}
                  {detail.records.length === 1
                    ? "záznam"
                    : detail.records.length < 5
                      ? "záznamy"
                      : "záznamů"}
                </span>
              </div>
            </div>

            {/* Records Table */}
            {detail.records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                        Poř. č.
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                        Datum vzniku
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                        Množství vzniklého
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                        Množství předaného
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.records.map((record) => (
                      <tr
                        key={`${detail.sheetName}-${record.poradoveCislo}-${record.datumVzniku}`}
                        className={cn(
                          "border-b border-gray-100 dark:border-gray-800 last:border-0",
                          record.isDuplicate && "bg-orange-50 dark:bg-orange-900/20"
                        )}
                        title={
                          record.isDuplicate
                            ? "Tento záznam byl přeskočen jako duplikát"
                            : undefined
                        }
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {record.isDuplicate && (
                              <span
                                className="text-orange-600 dark:text-orange-400 font-bold"
                                title="Duplikát"
                              >
                                ⚠️
                              </span>
                            )}
                            <span
                              className={cn(
                                record.isDuplicate
                                  ? "text-orange-900 dark:text-orange-100 line-through"
                                  : "text-gray-900 dark:text-white"
                              )}
                            >
                              {record.poradoveCislo}
                            </span>
                          </div>
                        </td>
                        <td
                          className={cn(
                            "py-2 px-3",
                            record.isDuplicate
                              ? "text-orange-900 dark:text-orange-100 line-through"
                              : "text-gray-900 dark:text-white"
                          )}
                        >
                          {record.datumVzniku || "-"}
                        </td>
                        <td
                          className={cn(
                            "py-2 px-3 text-right",
                            record.isDuplicate
                              ? "text-orange-900 dark:text-orange-100 line-through"
                              : "text-gray-900 dark:text-white"
                          )}
                        >
                          {record.mnozstviVznikleho || "-"}
                        </td>
                        <td
                          className={cn(
                            "py-2 px-3 text-right",
                            record.isDuplicate
                              ? "text-orange-900 dark:text-orange-100 line-through"
                              : "text-gray-900 dark:text-white"
                          )}
                        >
                          {record.mnozstviPredaneho || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Žádné záznamy k zobrazení
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
