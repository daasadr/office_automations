import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useLogger } from "@/lib/client-logger";
import type { FoundationDocumentProcessorProps, ProcessingResult } from "./types";
import { ProcessingState } from "./components/ProcessingState";
import { StatusUpdateMessage } from "./components/StatusUpdateMessage";
import { DownloadSection } from "./components/DownloadSection";
import { ApprovalActions } from "./components/ApprovalActions";
import { DuplicatesWarning } from "./components/DuplicatesWarning";
import { ProcessingStatistics } from "./components/ProcessingStatistics";
import { DocumentInfoCards } from "./components/DocumentInfoCards";
import { ErrorState } from "./components/ErrorState";
import { ExtractedRecordsDetail } from "./components/ExtractedRecordsDetail";
import { SheetsNotFoundWarning } from "./components/SheetsNotFoundWarning";

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

      // Use the local API route to download the foundation document
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
        throw new Error(`Download failed with status: ${response.status}`);
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download URL and trigger download
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${result.foundationDocument.title}.xlsx`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, 100);

      log.info("Foundation document download triggered", {
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

  const isStatusFinal =
    result?.foundationDocument.status === "approved" ||
    result?.foundationDocument.status === "rejected";

  return (
    <Card className="border-none">
      <CardContent className="space-y-4">
        {/* Processing State */}
        {!result && !error && <ProcessingState />}

        {/* Processing Result */}
        {result && (
          <div className="space-y-4">
            {/* Success Message if status was updated */}
            {statusUpdateSuccess && <StatusUpdateMessage status={statusUpdateSuccess} />}

            {/* Download Button */}
            <DownloadSection onDownload={handleDownload} isDownloading={isDownloading} />

            {/* Approve/Reject Actions */}
            {!isStatusFinal && (
              <ApprovalActions
                onApprove={() => handleUpdateStatus("approved")}
                onReject={() => handleUpdateStatus("rejected")}
                isUpdating={isUpdatingStatus}
              />
            )}

            {/* Duplicate Warning */}
            <DuplicatesWarning duplicates={result.processing.duplicatesSkipped} />

            {/* Sheets Not Found Warning */}
            <SheetsNotFoundWarning sheetsNotFound={result.processing.sheetsNotFound} />

            {/* Processing Statistics */}
            <ProcessingStatistics
              recordsAdded={result.processing.recordsAdded}
              extractedDataCount={result.processing.extractedDataCount}
              confidence={result.processing.confidence}
              sheetsModified={result.processing.sheetsModified}
            />

            {/* Extracted Records Detail */}
            <ExtractedRecordsDetail
              extractedRecords={result.processing.extractedRecordsDetail}
              duplicatesSkipped={result.processing.duplicatesSkipped}
            />

            {/* Document Info Cards */}
            <DocumentInfoCards
              newDocument={{
                title: result.foundationDocument.title,
                status: result.foundationDocument.status,
              }}
              basedOnDocument={{
                title: result.foundationDocument.basedOn.title,
              }}
            />
          </div>
        )}

        {/* Error State */}
        {error && <ErrorState error={error} />}
      </CardContent>
    </Card>
  );
}
