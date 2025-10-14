import { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useLogger } from "../lib/client-logger";

interface FoundationDocumentProcessorProps {
  documentId?: string;
  jobId?: string;
  autoTrigger?: boolean;
}

interface ProcessingResult {
  success: boolean;
  foundationDocument: {
    id: string;
    title: string;
    status: string;
    basedOn: {
      id: string;
      title: string;
    };
  };
  processing: {
    sheetsModified: string[];
    extractedDataCount: number;
    confidence: number;
    sourceDocumentId?: string;
    responseId?: string;
  };
}

export function FoundationDocumentProcessor({
  documentId,
  jobId,
  autoTrigger = false,
}: FoundationDocumentProcessorProps) {
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<"approved" | "rejected" | null>(
    null
  );
  const log = useLogger("FoundationDocumentProcessor");
  const hasTriggeredRef = useRef(false);

  // Auto-trigger processing on mount if autoTrigger is true
  useEffect(() => {
    const triggerProcessing = async () => {
      if (autoTrigger && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        log.info("Auto-triggering foundation document processing", { documentId, jobId });

        // Inline the processing call to avoid handleProcess dependency
        try {
          const response = await fetch("/api/process-foundation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, sourceDocumentId: documentId }),
          });

          if (response.ok) {
            const data = await response.json();
            setResult(data);
          } else {
            const errorData = await response.json();
            setError(errorData.error || "Failed to process foundation document");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unknown error occurred");
        }
      }
    };

    triggerProcessing();
  }, [autoTrigger, documentId, jobId, log]);

  const handleDownload = async () => {
    if (!result) return;

    log.userAction("foundation_document_download", {
      foundationDocumentId: result.foundationDocument.id,
    });
    setIsDownloading(true);

    try {
      log.info("Downloading foundation document", {
        foundationDocumentId: result.foundationDocument.id,
      });

      const response = await fetch("/api/download-foundation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foundationDocumentId: result.foundationDocument.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to download foundation document");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.foundationDocument.title}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      log.info("Foundation document downloaded successfully", {
        foundationDocumentId: result.foundationDocument.id,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Download failed";
      log.error(
        "Foundation document download failed",
        err instanceof Error ? err : new Error(errorMessage)
      );
      alert(`Download failed: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpdateStatus = async (status: "approved" | "rejected") => {
    if (!result) return;

    log.userAction(`foundation_document_${status}`, {
      foundationDocumentId: result.foundationDocument.id,
    });
    setIsUpdatingStatus(true);
    setStatusUpdateSuccess(null);

    try {
      log.info(`Updating foundation document status to ${status}`, {
        foundationDocumentId: result.foundationDocument.id,
        status,
      });

      const response = await fetch("/api/update-foundation-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foundationDocumentId: result.foundationDocument.id,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      await response.json();

      log.info(`Foundation document status updated to ${status}`, {
        foundationDocumentId: result.foundationDocument.id,
        status,
      });

      setStatusUpdateSuccess(status);

      // Update result to reflect new status
      setResult({
        ...result,
        foundationDocument: {
          ...result.foundationDocument,
          status: status,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Status update failed";
      log.error(
        "Foundation document status update failed",
        err instanceof Error ? err : new Error(errorMessage)
      );
      alert(`Status update failed: ${errorMessage}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Card className="border-none">
      <CardContent className="space-y-4">
        {/* Processing State */}
        {!result && !error && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  Zpracovávám zakládací dokument...
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  Probíhá augmentace schváleného dokumentu extrahovanými daty
                </p>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Proces augmentace:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Načítání posledního schváleného zakládacího dokumentu</li>
                <li>Vyhledávání listů odpovídajících kódům odpadů a IČO</li>
                <li>Přidávání extrahovaných dat do příslušných řádků</li>
                <li>Ukládání jako nový koncept pro kontrolu</li>
              </ul>
            </div>
          </div>
        )}

        {/* Processing Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold text-green-900 dark:text-green-100">
                  Foundation Document Processed Successfully!
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200">
                  A new draft foundation document has been created and saved to Directus.
                </p>
              </div>
            </div>

            {/* Success Message if status was updated */}
            {statusUpdateSuccess && (
              <div
                className={`flex items-start gap-3 p-4 rounded-lg ${
                  statusUpdateSuccess === "approved"
                    ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                    : "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900"
                }`}
              >
                <CheckCircle
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    statusUpdateSuccess === "approved"
                      ? "text-green-600 dark:text-green-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                />
                <div className="flex-1">
                  <h4
                    className={`font-semibold ${
                      statusUpdateSuccess === "approved"
                        ? "text-green-900 dark:text-green-100"
                        : "text-orange-900 dark:text-orange-100"
                    }`}
                  >
                    {statusUpdateSuccess === "approved"
                      ? "Dokument schválen!"
                      : "Dokument odmítnut"}
                  </h4>
                  <p
                    className={`text-sm mt-1 ${
                      statusUpdateSuccess === "approved"
                        ? "text-green-800 dark:text-green-200"
                        : "text-orange-800 dark:text-orange-200"
                    }`}
                  >
                    {statusUpdateSuccess === "approved"
                      ? "Zakládací dokument byl úspěšně schválen a je nyní aktivní."
                      : "Zakládací dokument byl odmítnut a zůstává jako koncept."}
                  </p>
                </div>
              </div>
            )}

            {/* Download Button */}
            <div className="p-4 border-2 border-primary/20 bg-primary/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">Stáhnout augmentovaný dokument</h4>
                  <p className="text-sm text-muted-foreground">
                    Před schválením si prosím stáhněte dokument a zkontrolujte změny
                  </p>
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  size="lg"
                  variant="default"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Stahuji...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Stáhnout dokument
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Approve/Reject Actions */}
            {result.foundationDocument.status !== "approved" &&
              result.foundationDocument.status !== "rejected" && (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Zkontrolujte změny a potvrďte
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Stáhněte si dokument, zkontrolujte doplněná data a pokud jsou správná,
                      schvalte dokument. V případě chyb dokument odmítněte a obnovte stránku pro
                      nové vygenerování.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => handleUpdateStatus("approved")}
                      disabled={isUpdatingStatus}
                      size="lg"
                      variant="default"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isUpdatingStatus ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Zpracovávám...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Přijmout (Schválit)
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleUpdateStatus("rejected")}
                      disabled={isUpdatingStatus}
                      size="lg"
                      variant="destructive"
                      className="flex-1"
                    >
                      {isUpdatingStatus ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Zpracovávám...
                        </>
                      ) : (
                        <>
                          <X className="mr-2 h-4 w-4" />
                          Odmítnout
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

            {/* Processing Statistics */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-semibold">Processing Details</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {result.processing.sheetsModified.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Sheets Modified</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {result.processing.extractedDataCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Data Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {result.processing.confidence.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Confidence</div>
                </div>
              </div>

              {result.processing.sheetsModified.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-sm font-medium mb-2">Modified Sheets:</div>
                  <div className="flex flex-wrap gap-2">
                    {result.processing.sheetsModified.map((sheet) => (
                      <Badge key={sheet} variant="secondary">
                        {sheet}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 border rounded-lg space-y-2">
                <div className="text-sm font-medium text-muted-foreground">New Document</div>
                <div className="font-semibold">{result.foundationDocument.title}</div>
                <Badge variant="outline" className="mt-1">
                  {result.foundationDocument.status}
                </Badge>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Based On</div>
                <div className="font-semibold">{result.foundationDocument.basedOn.title}</div>
                <Badge variant="secondary" className="mt-1">
                  approved
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-100">Processing Failed</h4>
                <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</p>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm">Možné příčiny:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>V Directus nebyl nalezen žádný schválený zakládací dokument</li>
                <li>Schválený dokument nemá připojený Excel soubor</li>
                <li>Názvy listů neodpovídají očekávanému formátu (kód odpadu + IČO)</li>
                <li>V dokumentu chybí požadované záhlaví sloupců</li>
              </ul>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Pro opakování:</strong> Obnovte stránku (F5) a dokument bude automaticky
                zpracován znovu.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
