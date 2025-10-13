import { useState } from "react";
import { FileSpreadsheet, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useLogger } from "../lib/client-logger";
import { ORCHESTRATION_API_URL } from "../constants";

interface FoundationDocumentProcessorProps {
  documentId?: string;
  jobId?: string;
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
}: FoundationDocumentProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useLogger("FoundationDocumentProcessor");

  const handleProcess = async (isReprocess = false) => {
    log.userAction(isReprocess ? "foundation_reprocess_start" : "foundation_process_start", {
      jobId,
      documentId,
    });
    setIsProcessing(true);
    setError(null);
    if (!isReprocess) {
      setResult(null);
    }

    const startTime = Date.now();

    try {
      log.info("Processing foundation document", { jobId, documentId });

      const response = await fetch("/api/process-foundation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, sourceDocumentId: documentId }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to process foundation document";

        log.error("Foundation processing failed", new Error(errorMessage), {
          jobId,
          statusCode: response.status,
          duration,
          details: errorData.details,
        });

        throw new Error(errorMessage);
      }

      const data: ProcessingResult = await response.json();

      log.info(
        isReprocess
          ? "Foundation document reprocessed successfully"
          : "Foundation document processed successfully",
        {
          jobId,
          duration,
          foundationDocumentId: data.foundationDocument.id,
          sheetsModified: data.processing.sheetsModified.length,
          extractedDataCount: data.processing.extractedDataCount,
          isReprocess,
        }
      );

      setResult(data);
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";

      log.error(
        "Foundation processing error",
        err instanceof Error ? err : new Error(errorMessage),
        {
          jobId,
          duration,
        }
      );

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Foundation Document Processing</CardTitle>
              <CardDescription className="mt-1">
                Augment your approved foundation Excel document with extracted data
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Initial State */}
        {!result && !error && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">What this does:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Retrieves your last approved foundation document</li>
                <li>Finds sheets matching waste codes and company IDs</li>
                <li>Adds extracted data to the appropriate rows</li>
                <li>Saves as a new draft for your review</li>
              </ul>
            </div>

            <Button
              onClick={() => handleProcess(false)}
              disabled={isProcessing}
              className="w-full sm:w-auto"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Foundation Document...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Process Foundation Document
                </>
              )}
            </Button>
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

            {/* Document Details */}
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="default"
                size="lg"
                className="flex-1"
                onClick={() => {
                  const directusUrl = ORCHESTRATION_API_URL.replace(":3001", ":8055");
                  window.open(`${directusUrl}/admin/content/foundation_documents`, "_blank");
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Open in Directus
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => handleProcess(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reprocessing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reprocess
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-muted rounded space-y-2">
              <p>
                <strong>Note:</strong> The document has been saved as a draft. Please review it in
                Directus and approve when ready. You can download the file directly from Directus or
                access it via the Directus API.
              </p>
              <p>
                <strong>Reprocess:</strong> Use the reprocess button to regenerate the augmented
                document with the current backend logic. This is useful after bug fixes or when you
                want to apply updated processing rules to the same source data.
              </p>
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
              <h4 className="font-semibold text-sm">Common Issues:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>No approved foundation document found in Directus</li>
                <li>Approved document doesn't have an Excel file attached</li>
                <li>Sheet names don't match the expected pattern (waste code + IČO)</li>
                <li>Required column headers are missing</li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setResult(null);
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
