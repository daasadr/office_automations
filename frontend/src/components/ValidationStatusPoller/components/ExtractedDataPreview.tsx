import { Package, Building2, User } from "lucide-react";
import type { ExtractedDataRecord } from "../types";

interface ExtractedDataPreviewProps {
  extractedData: ExtractedDataRecord[];
}

export function ExtractedDataPreview({ extractedData }: ExtractedDataPreviewProps) {
  if (!extractedData || extractedData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="space-y-4">
        {extractedData.map((data, index) => (
          <div
            key={`waste-${data["kód odpadu"]}-${data.odběratel?.IČO}-${index}`}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
          >
            {/* Waste Info */}
            <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {data["název/druh odpadu"] || "Název odpadu nenalezen"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Kód odpadu:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {data["kód odpadu"] || "-"}
                      </span>
                    </div>
                    {data["kategorie odpadu"] && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Kategorie:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {data["kategorie odpadu"]}
                        </span>
                      </div>
                    )}
                    {data["kód způsobu nakládání"] && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Kód nakládání:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {data["kód způsobu nakládání"]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Původce a Odběratel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Původce */}
              {data.původce && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      Původce
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    {data.původce.název && (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.původce.název}
                      </div>
                    )}
                    {data.původce.IČO && (
                      <div className="text-gray-600 dark:text-gray-400">
                        IČO: {data.původce.IČO}
                      </div>
                    )}
                    {data.původce.adresa && (
                      <div className="text-gray-600 dark:text-gray-400">{data.původce.adresa}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Odběratel */}
              {data.odběratel && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      Odběratel
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    {data.odběratel.název && (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.odběratel.název}
                      </div>
                    )}
                    {data.odběratel.IČO && (
                      <div className="text-gray-600 dark:text-gray-400">
                        IČO: {data.odběratel.IČO}
                      </div>
                    )}
                    {data.odběratel.adresa && (
                      <div className="text-gray-600 dark:text-gray-400">
                        {data.odběratel.adresa}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tabulka Preview */}
            {data.tabulka && data.tabulka.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Záznamy ({data.tabulka.length})
                  </span>
                </div>
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
                      {data.tabulka.map((record, recordIndex: number) => {
                        // Handle both old typo "vznikého" and correct "vzniklého"
                        const mnozstviVzniklého =
                          record["množství vzniklého odpadu"] || record["množství vznikého odpadu"];
                        const mnozstviPředaného = record["množství předaného odpadu"];

                        // Format quantity values - handle both numbers and strings
                        const formatQuantity = (value: string | number | undefined | null) => {
                          if (value == null) return "-";
                          // If it's a number, format with 2 decimal places
                          if (typeof value === "number") {
                            return value.toFixed(2);
                          }
                          // If it's a string, return as is (might have units)
                          return String(value);
                        };

                        return (
                          <tr
                            key={`record-${record["pořadové číslo"]}-${record["datum vzniku"]}-${recordIndex}`}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {record["pořadové číslo"] || "-"}
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {record["datum vzniku"] || "-"}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {formatQuantity(mnozstviVzniklého)}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {formatQuantity(mnozstviPředaného)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
