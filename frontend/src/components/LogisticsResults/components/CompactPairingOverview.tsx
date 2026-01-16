import { AlertTriangle, Building2, CheckCircle, Copy, MapPin, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { TransportLineItem } from "../types";

interface CompactPairingOverviewProps {
  items: TransportLineItem[];
}

// Helper function to translate match reason patterns to Czech
function translateMatchReason(reason?: string): string {
  if (!reason) return "";

  const translated = reason
    .replace(/Delivery Note/g, "Dodací list")
    .replace(/Transport Log/g, "Přepravní deník")
    .replace(/Matched based on destination/g, "Spárováno na základě destinace")
    .replace(/found in/g, "nalezené v")
    .replace(/No document found with destination/g, "Nebyl nalezen dokument s destinací")
    .replace(/and/g, "a");

  return translated;
}

export function CompactPairingOverview({ items }: CompactPairingOverviewProps) {
  const [copiedItemId, setCopiedItemId] = useState<string | number | null>(null);

  if (!items || items.length === 0) {
    return null;
  }

  // Filter for matched items
  const matchedItems = items.filter((item) => item.match_status === "Matched");

  if (matchedItems.length === 0) {
    return null;
  }

  // Calculate statistics
  const totalItems = items.length;
  const matchedCount = matchedItems.length;

  // Count how many matched items have order numbers
  const matchedWithOrders = matchedItems.filter((item) => {
    const hasOrders = item.associated_documents?.some(
      (doc) => doc.reference_numbers?.order_number_ours
    );
    return hasOrders;
  }).length;

  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
    }).format(amount);
  };

  const copyOrderNumbers = async (orderNumbers: string, itemId: string | number) => {
    try {
      // Format with semicolons: "S2359337;S2359485;S2359648"
      // Split by comma and optional spaces, trim each, rejoin with semicolon
      const formattedOrders = orderNumbers
        .split(/,\s*/)
        .map((order) => order.trim())
        .join(";");

      // Try modern Clipboard API first
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedOrders);
      } else {
        // Fallback to older method
        const textArea = document.createElement("textarea");
        textArea.value = formattedOrders;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setCopiedItemId(itemId);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Přehled párování objednávek</h2>

      {/* Balance Summary */}
      <div className="bg-card border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Spárováno:</span>
            <span className="font-semibold">
              {matchedCount} z {totalItems}
            </span>
            <span className="text-muted-foreground">
              ({Math.round((matchedCount / totalItems) * 100)}%)
            </span>
            {matchedCount < totalItems && (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-medium">{totalItems - matchedCount} nespárováno</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-orange-500" />
            <span className="text-muted-foreground">S číslem objednávky:</span>
            <span className="font-semibold">
              {matchedWithOrders} z {matchedCount}
            </span>
            {matchedWithOrders < matchedCount && (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-medium">{matchedCount - matchedWithOrders} chybí</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {matchedItems.map((item, index) => {
          // Get the first associated document with recipient info
          const primaryDoc = item.associated_documents?.find(
            (doc) => doc.recipient_name && doc.destination_address
          );

          // Collect all "our" order numbers from all associated documents
          const allOurOrders = item.associated_documents
            ?.map((doc) => doc.reference_numbers?.order_number_ours)
            .filter((order): order is string => !!order)
            .join(", ");

          // Determine if orders are missing
          const hasOrders = !!allOurOrders;

          // Use red/warning colors if orders are missing, green if present
          const borderClass = hasOrders
            ? "border-green-200 dark:border-green-900"
            : "border-red-200 dark:border-red-900";
          const headerBgClass = hasOrders
            ? "bg-green-50 dark:bg-green-950/30"
            : "bg-red-50 dark:bg-red-950/30";
          const badgeBgClass = hasOrders
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";

          return (
            <div
              key={item.line_id || index}
              className={`border ${borderClass} rounded-lg overflow-hidden`}
            >
              {/* Header with conditional background color */}
              <div className={`px-4 py-3 flex items-center justify-between ${headerBgClass}`}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${badgeBgClass}`}
                  >
                    {item.line_id || index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{item.description || "Bez popisu"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.invoice_amount)} {item.vat_rate && `(${item.vat_rate})`}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${badgeBgClass} text-sm`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Spárováno
                </span>
              </div>

              {/* Match reason */}
              {item.match_reason && (
                <div className="px-4 py-2 border-t bg-muted/30 text-sm text-muted-foreground">
                  {translateMatchReason(item.match_reason)}
                </div>
              )}

              {/* Company info and orders */}
              {primaryDoc ? (
                <div className="px-4 py-3 border-t space-y-2">
                  {/* Company name */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-base">{primaryDoc.recipient_name}</div>
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {primaryDoc.destination_address}
                    </div>
                  </div>

                  {/* Our orders with orange badge OR red warning if missing */}
                  <div className="pt-2 flex items-center gap-2">
                    {hasOrders ? (
                      <>
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-sm font-medium">
                          <ShoppingBag className="w-3 h-3" />
                          <span>Naše obj.: {allOurOrders}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyOrderNumbers(allOurOrders, item.line_id || index)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-colors ${
                            copiedItemId === (item.line_id || index)
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
                          }`}
                          title="Zkopírovat čísla objednávek"
                        >
                          <Copy className="w-3 h-3" />
                          <span>
                            {copiedItemId === (item.line_id || index)
                              ? "Zkopírováno!"
                              : "Zkopírovat objednávky"}
                          </span>
                        </button>
                      </>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-sm font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Nenalezeno číslo objednávky</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 border-t">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-sm font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Nenalezeno číslo objednávky</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
