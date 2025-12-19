import { CheckCircle, FileText, Hash, MapPin, PenTool, XCircle } from "lucide-react";
import type { TransportLineItem } from "../types";

interface TransportLineItemCardProps {
  item: TransportLineItem;
}

export function TransportLineItemCard({ item }: TransportLineItemCardProps) {
  const isMatched = item.match_status === "Matched";

  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
    }).format(amount);
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        isMatched
          ? "border-green-200 dark:border-green-900"
          : "border-yellow-200 dark:border-yellow-900"
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          isMatched ? "bg-green-50 dark:bg-green-950/30" : "bg-yellow-50 dark:bg-yellow-950/30"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isMatched
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            }`}
          >
            {item.line_id || "?"}
          </div>
          <div>
            <p className="font-medium">{item.description || "Bez popisu"}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(item.invoice_amount)} {item.vat_rate && `(${item.vat_rate})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMatched ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-sm">
              <CheckCircle className="w-4 h-4" />
              Spárováno
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-sm">
              <XCircle className="w-4 h-4" />
              Nespárováno
            </span>
          )}
        </div>
      </div>

      {/* Match reason */}
      {item.match_reason && (
        <div className="px-4 py-2 border-t bg-muted/30 text-sm text-muted-foreground">
          {item.match_reason}
        </div>
      )}

      {/* Associated documents */}
      {item.associated_documents && item.associated_documents.length > 0 && (
        <div className="px-4 py-3 border-t space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Přiřazené dokumenty ({item.associated_documents.length})
          </p>
          <div className="grid gap-2">
            {item.associated_documents.map((doc, index) => (
              <div
                key={`${doc.source_page_index ?? index}-${doc.document_number ?? ""}-${doc.document_type ?? ""}`}
                className="flex items-start gap-3 p-3 bg-muted/30 rounded-md"
              >
                <FileText className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{doc.document_type || "Dokument"}</span>
                    {doc.document_number && (
                      <span className="text-sm text-muted-foreground">
                        č. {doc.document_number}
                      </span>
                    )}
                    {doc.source_page_index && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        Strana {doc.source_page_index}
                      </span>
                    )}
                    {doc.contains_handwriting && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded">
                        <PenTool className="w-3 h-3" />
                        Ručně psáno
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    {doc.recipient_name && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {doc.recipient_name}
                      </span>
                    )}
                    {doc.destination_address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {doc.destination_address}
                      </span>
                    )}
                  </div>

                  {doc.reference_numbers && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {doc.reference_numbers.order_number && (
                        <span>Obj.: {doc.reference_numbers.order_number}</span>
                      )}
                      {doc.reference_numbers.delivery_number && (
                        <span className="ml-3">Dod.: {doc.reference_numbers.delivery_number}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No documents message */}
      {(!item.associated_documents || item.associated_documents.length === 0) && (
        <div className="px-4 py-3 border-t text-sm text-muted-foreground italic">
          Žádné přiřazené dokumenty
        </div>
      )}
    </div>
  );
}
