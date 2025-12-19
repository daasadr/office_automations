import { Building2, Package, User } from "lucide-react";
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
            key={`waste-${data.waste_code}-${data.recipient?.company_id}-${index}`}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
          >
            {/* Waste Info */}
            <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {data.waste_name || "Název odpadu nenalezen"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Kód odpadu:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {data.waste_code || "-"}
                      </span>
                    </div>
                    {data.waste_category && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Kategorie:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {data.waste_category}
                        </span>
                      </div>
                    )}
                    {data.handling_code && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Kód nakládání:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {data.handling_code}
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
              {data.originator && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      Původce
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    {data.originator.name && (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.originator.name}
                      </div>
                    )}
                    {data.originator.company_id && (
                      <div className="text-gray-600 dark:text-gray-400">
                        IČO: {data.originator.company_id}
                      </div>
                    )}
                    {data.originator.address && (
                      <div className="text-gray-600 dark:text-gray-400">
                        {data.originator.address}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Odběratel */}
              {data.recipient && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      Odběratel
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    {data.recipient.name && (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.recipient.name}
                      </div>
                    )}
                    {data.recipient.company_id && (
                      <div className="text-gray-600 dark:text-gray-400">
                        IČO: {data.recipient.company_id}
                      </div>
                    )}
                    {data.recipient.address && (
                      <div className="text-gray-600 dark:text-gray-400">
                        {data.recipient.address}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Records Preview */}
            {data.records && data.records.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Záznamy ({data.records.length})
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
                      {data.records.map((record, recordIndex: number) => {
                        // Format quantity values - handle both numbers and strings
                        const formatQuantity = (value: number | undefined | null) => {
                          if (value == null) return "-";
                          // If it's a number, format with 2 decimal places
                          if (typeof value === "number") {
                            return value.toFixed(2);
                          }
                          // If it's a string, return as is (shouldn't happen with new schema)
                          return String(value);
                        };

                        return (
                          <tr
                            key={`record-${record.serial_number}-${record.date}-${recordIndex}`}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {record.serial_number || "-"}
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {record.date || "-"}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {formatQuantity(record.waste_amount_generated)}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {formatQuantity(record.waste_amount_transferred)}
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
