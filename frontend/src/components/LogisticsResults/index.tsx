import { Loader2, RefreshCw, Truck, XCircle } from "lucide-react";
import { useState } from "react";
import { withBasePath } from "@/lib/utils";
import { InvoiceHeaderCard } from "./components/InvoiceHeaderCard";
import { SummaryCard } from "./components/SummaryCard";
import { TransportLineItemCard } from "./components/TransportLineItemCard";
import { UnclaimedDocumentsCard } from "./components/UnclaimedDocumentsCard";
import { useLogisticsDocument } from "./hooks/useLogisticsDocument";
import type { LogisticsResultsProps } from "./types";

export function LogisticsResults({ documentId }: LogisticsResultsProps) {
  const { document, isLoading, error } = useLogisticsDocument({ documentId });
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);

  const handleReprocess = async () => {
    if (!documentId) return;

    setIsReprocessing(true);
    setReprocessError(null);

    try {
      const response = await fetch(withBasePath("/api/reprocess-logistics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        window.location.href = withBasePath(`/logistika/check?job=${result.jobId}`);
      } else {
        setReprocessError(result.error || "Opětovné zpracování selhalo");
      }
    } catch (err) {
      setReprocessError(err instanceof Error ? err.message : "Neznámá chyba");
    } finally {
      setIsReprocessing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
        <p className="text-lg text-muted-foreground">Načítám výsledky...</p>
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg text-destructive">{error || "Dokument nenalezen"}</p>
        <a href={withBasePath("/logistika/upload")} className="text-primary hover:underline">
          Nahrát nový dokument
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      <SummaryCard data={document} />

      {/* Invoice Header */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Informace o faktuře</h2>
        <InvoiceHeaderCard header={document.invoice_header} />
      </section>

      {/* Transport Line Items */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-semibold">
            Položky přepravy ({document.transport_line_items?.length || 0})
          </h2>
        </div>

        {document.transport_line_items && document.transport_line_items.length > 0 ? (
          <div className="space-y-4">
            {document.transport_line_items.map((item, index) => (
              <TransportLineItemCard key={item.line_id || index} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nebyly nalezeny žádné položky přepravy
          </div>
        )}
      </section>

      {/* Unclaimed Documents */}
      {document.unclaimed_documents && document.unclaimed_documents.length > 0 && (
        <section>
          <UnclaimedDocumentsCard documents={document.unclaimed_documents} />
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-col items-center gap-4 pt-8 border-t">
        {reprocessError && <p className="text-sm text-destructive">{reprocessError}</p>}
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 h-11 px-6"
          >
            {isReprocessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Zpracovat znovu
          </button>
          <a
            href={withBasePath("/logistika/upload")}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 h-11 px-6"
          >
            Nahrát další dokument
          </a>
          <a
            href={withBasePath("/logistika")}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-6"
          >
            Zpět na přehled
          </a>
        </div>
      </div>
    </div>
  );
}
