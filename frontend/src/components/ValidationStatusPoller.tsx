import { useState, useEffect, useRef } from "react";
import { FileText, Check, RefreshCw, ChevronLeft, CloudUpload, ArrowRight } from "lucide-react";
import { ValidationResults } from "@/components/ValidationResults";
import { useLogger } from "@/lib/client-logger";

interface ValidationData {
  validationResult: {
    present: string[];
    missing: string[];
    confidence: number;
  };
  directusSourceDocumentId?: string;
  status?: string;
}

interface ValidationStatusPollerProps {
  documentId?: string;
  jobId?: string;
}

export function ValidationStatusPoller({ documentId, jobId }: ValidationStatusPollerProps) {
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const log = useLogger("ValidationStatusPoller");

  useEffect(() => {
    if (!isPolling) {
      log.info("Polling stopped - isPolling is false");
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const fetchValidationData = async () => {
      try {
        log.info("Fetching validation data", { documentId, jobId });

        // Use frontend API proxy to avoid CORS issues
        const url = documentId ? `/api/status-by-source/${documentId}` : `/api/status/${jobId}`;

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();

          // Check if we have complete validation data
          if (
            data.validationResult &&
            data.validationResult.present !== undefined &&
            data.validationResult.missing !== undefined &&
            data.validationResult.confidence !== undefined
          ) {
            log.info("Valid validation data received - stopping polling", {
              hasPresent: !!data.validationResult.present,
              hasMissing: !!data.validationResult.missing,
              hasConfidence: typeof data.validationResult.confidence !== "undefined",
              dataStructure: {
                present: data.validationResult.present?.length,
                missing: data.validationResult.missing?.length,
                confidence: data.validationResult.confidence,
              },
            });

            // Clear interval immediately
            if (intervalRef.current) {
              log.info("Clearing polling interval after receiving data");
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

            // Update state to stop polling and show results
            setValidationData(data);
            setIsPolling(false);
          } else {
            log.info("Validation data incomplete, will retry", {
              status: data.status,
              hasValidationResult: !!data.validationResult,
              validationResultKeys: data.validationResult ? Object.keys(data.validationResult) : [],
            });
          }
        } else {
          log.warn("Failed to fetch validation data", { status: response.status });
        }
      } catch (error) {
        log.error("Error fetching validation data", error as Error);
      }
    };

    // Initial fetch
    fetchValidationData();

    // Set up polling interval
    log.info("Starting polling interval");
    intervalRef.current = setInterval(fetchValidationData, 2000);

    return () => {
      if (intervalRef.current) {
        log.info("Cleaning up polling interval in effect cleanup");
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [documentId, jobId, isPolling, log]);

  // Determine download URL
  const sourceDocumentId = validationData?.directusSourceDocumentId || documentId;
  const downloadUrl = sourceDocumentId
    ? `/download?doc=${sourceDocumentId}`
    : `/download?job=${jobId}`;

  // Debug logging
  useEffect(() => {
    if (validationData) {
      log.info("ValidationData is set, should show results now", {
        hasPresent: !!validationData.validationResult?.present,
        hasMissing: !!validationData.validationResult?.missing,
        hasConfidence: !!validationData.validationResult?.confidence,
        downloadUrl,
      });
    }
  }, [validationData, downloadUrl, log]);

  if (!validationData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-8">
          <div className="text-center space-y-6">
            {/* Animated spinner */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Status message */}
            <div>
              <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                Analyzuji dokument...
              </h2>
              <p className="text-blue-800 dark:text-blue-200">
                Používám AI pro extrakci dat z PDF dokumentu
              </p>
            </div>

            {/* Progress steps */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Soubor nahrán
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Zpracování s AI modelem...
                  </span>
                </div>
                <div className="flex items-center gap-3 opacity-50">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Validace výsledků
                  </span>
                </div>
              </div>
            </div>

            {/* Info text */}
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <p>Toto může trvat 10-60 sekund v závislosti na velikosti dokumentu.</p>
              <p className="text-xs">Stránka se automaticky aktualizuje každé 2 sekundy.</p>
            </div>
          </div>
        </div>

        {/* Alternative actions */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Obnovit nyní
          </button>

          <a
            href="/upload"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Zpět
          </a>
        </div>
      </div>
    );
  }

  // Show validation results when data is available
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <ValidationResults
        present={validationData.validationResult.present}
        missing={validationData.validationResult.missing}
        confidence={validationData.validationResult.confidence}
      />

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
        <a
          href="/upload"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors min-w-48"
        >
          <CloudUpload className="w-5 h-5" />
          Nahrát jiný dokument
        </a>

        <a
          href={downloadUrl}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl min-w-48"
        >
          <ArrowRight className="w-5 h-5" />
          Pokračovat ke stažení
        </a>
      </div>
    </div>
  );
}
