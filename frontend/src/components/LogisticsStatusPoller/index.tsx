import { AlertTriangle, CheckCircle, FileText, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { withBasePath } from "@/lib/utils";
import { useLogisticsPolling } from "./hooks/useLogisticsPolling";
import type { LogisticsStatusPollerProps } from "./types";

export function LogisticsStatusPoller({ jobId }: LogisticsStatusPollerProps) {
  const { statusData, isPolling, error } = useLogisticsPolling({ jobId });
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);

  const handleReprocess = async () => {
    if (!statusData?.logisticsDocumentId) return;

    setIsReprocessing(true);
    setReprocessError(null);

    try {
      const response = await fetch(withBasePath("/api/reprocess-logistics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: statusData.logisticsDocumentId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Redirect to check page with new job ID
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
  if (isPolling && !statusData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
        <p className="text-lg text-muted-foreground">Načítám stav zpracování...</p>
      </div>
    );
  }

  // Error state
  if (error && !statusData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg text-destructive">{error}</p>
        <a href={withBasePath("/logistika/upload")} className="text-primary hover:underline">
          Zkusit znovu
        </a>
      </div>
    );
  }

  // Processing state
  if (statusData && (statusData.status === "pending" || statusData.status === "processing")) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 animate-spin text-orange-500" />
          <FileText className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-orange-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Zpracovávám dokument...</h2>
          <p className="text-muted-foreground">Analyzuji fakturu a přepravní dokumenty</p>
          {statusData.wasChunked && statusData.chunkCount && (
            <p className="text-sm text-muted-foreground">
              Dokument je rozdělen na {statusData.chunkCount} částí
            </p>
          )}
        </div>
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse rounded-full w-3/4" />
        </div>
      </div>
    );
  }

  // Failed state
  if (statusData && statusData.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <XCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-2xl font-semibold text-destructive">Zpracování selhalo</h2>
        <p className="text-muted-foreground">{statusData.error || "Neznámá chyba"}</p>
        <a
          href={withBasePath("/logistika/upload")}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
        >
          Zkusit znovu
        </a>
      </div>
    );
  }

  // Completed state - redirect to results
  if (statusData && statusData.status === "completed") {
    // Show duplicate notice if applicable
    if (statusData.isDuplicate) {
      return (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Dokument již byl zpracován</h2>
            <p className="text-muted-foreground">
              Tento dokument byl již dříve nahrán a zpracován.
            </p>
          </div>
          {reprocessError && <p className="text-sm text-destructive">{reprocessError}</p>}
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={withBasePath(`/logistika/results?doc=${statusData.logisticsDocumentId}`)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
            >
              <CheckCircle className="w-4 h-4" />
              Zobrazit výsledky
            </a>
            <button
              type="button"
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 h-10 px-4"
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
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
            >
              Nahrát jiný dokument
            </a>
          </div>
        </div>
      );
    }

    // Regular completion
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Zpracování dokončeno</h2>
          <p className="text-muted-foreground">Dokument byl úspěšně analyzován</p>
        </div>
        <a
          href={withBasePath(`/logistika/results?doc=${statusData.logisticsDocumentId}`)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 h-11 px-6 text-lg"
        >
          <CheckCircle className="w-5 h-5" />
          Zobrazit výsledky
        </a>
      </div>
    );
  }

  return null;
}
