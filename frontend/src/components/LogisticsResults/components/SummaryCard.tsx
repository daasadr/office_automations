import { AlertTriangle, CheckCircle, Clock, Layers, ShoppingBag, Tag, XCircle } from "lucide-react";
import type { LogisticsDocumentData } from "../types";

interface SummaryCardProps {
  data: LogisticsDocumentData;
}

export function SummaryCard({ data }: SummaryCardProps) {
  const matchedCount =
    data.transport_line_items?.filter((item) => item.match_status === "Matched").length || 0;
  const unmatchedCount =
    data.transport_line_items?.filter((item) => item.match_status === "Unmatched").length || 0;
  const totalItems = data.transport_line_items?.length || 0;
  const unclaimedCount = data.unclaimed_documents?.length || 0;

  const matchPercentage = totalItems > 0 ? (matchedCount / totalItems) * 100 : 0;

  // Calculate order number statistics
  const orderNumbers =
    data.transport_line_items?.flatMap(
      (item) => item.associated_documents?.map((doc) => doc.reference_numbers).filter(Boolean) || []
    ) || [];

  const orderNumbersOurs = orderNumbers.filter((ref) => ref?.order_number_ours).length;
  const orderNumberCategories = orderNumbers.reduce(
    (acc, ref) => {
      if (ref?.order_number_category && ref.order_number_category !== "Unknown") {
        acc[ref.order_number_category] = (acc[ref.order_number_category] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <h2 className="text-xl font-semibold">Souhrn zpracování</h2>
      <div className="bg-card border rounded-lg p-6">
        <div className="grid md:grid-cols-4 gap-4">
          {/* Matched items */}
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {matchedCount}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">Spárováno</p>
            </div>
          </div>

          {/* Unmatched items */}
          <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                {unmatchedCount}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Nespárováno</p>
            </div>
          </div>

          {/* Unclaimed documents */}
          {/* <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {unclaimedCount}
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400">Nepřiřazeno</p>
            </div>
          </div> */}

          {/* Confidence */}
          {/* <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {data.confidence ? `${Math.round(data.confidence)}%` : "-"}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Spolehlivost</p>
            </div>
          </div> */}
        </div>

        {/* Progress bar */}
        {totalItems > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Úspěšnost párování</span>
              <span>{Math.round(matchPercentage)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                style={{ width: `${matchPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Order Number Statistics */}
        {orderNumbersOurs > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <h4 className="text-sm font-semibold">Statistiky čísel objednávek</h4>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Celkem našich objednávek:{" "}
                <span className="font-medium text-foreground">{orderNumbersOurs}</span>
              </div>
              {Object.keys(orderNumberCategories).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(orderNumberCategories).map(([category, count]) => (
                    <div
                      key={category}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs"
                    >
                      <Tag className="w-3 h-3" />
                      <span>
                        {category}: {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing info */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm text-muted-foreground">
          {data.was_chunked && data.chunk_count && (
            <span className="inline-flex items-center gap-1">
              <Layers className="w-4 h-4" />
              Zpracováno v {data.chunk_count} částech
            </span>
          )}
          {data.processing_time_ms && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Doba zpracování: {(data.processing_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </>
  );
}
