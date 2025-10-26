import { useState, useEffect, useCallback, useId, type FC } from "react";
import { Download } from "lucide-react";
import { useLogger } from "../lib/client-logger";

export interface ExcelDownloadButtonProps {
  documentId?: string;
  jobId?: string;
  className?: string;
  disabled?: boolean;
}

export interface ExcelDownloadState {
  status: "preparing" | "ready" | "unavailable" | "generating";
  filename?: string;
  downloadUrl?: string;
  error?: string;
}

export const ExcelDownloadButton: FC<ExcelDownloadButtonProps> = ({
  documentId,
  jobId,
  className = "",
  disabled = false,
}) => {
  const [state, setState] = useState<ExcelDownloadState>({ status: "preparing" });
  const [hasAttempted, setHasAttempted] = useState(false);
  const logger = useLogger("ExcelDownloadButton");
  const linkId = useId();
  const textId = useId();

  const generateExcelFile = useCallback(async () => {
    logger.info("Starting Excel file generation", { documentId, jobId });
    setState({ status: "generating" });

    try {
      logger.debug("Making POST request to /api/generate-excel", { documentId, jobId });

      const response = await fetch("/api/generate-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentId, jobId }),
      });

      logger.debug("Response received", {
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok) {
        const result = await response.json();
        logger.info("Excel file generated successfully", {
          filename: result.filename,
          downloadUrl: result.downloadUrl,
        });

        setState({
          status: "ready",
          filename: result.filename,
          downloadUrl: result.downloadUrl,
        });
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.error("Failed to generate Excel file", undefined, {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });

        setState({
          status: "unavailable",
          error: `Failed to generate Excel file: ${response.status}`,
        });
      }
    } catch (error) {
      logger.error(
        "Exception during Excel file generation",
        error instanceof Error ? error : undefined,
        {
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );

      setState({
        status: "unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [documentId, jobId, logger]);

  useEffect(() => {
    logger.mount({ documentId, jobId });
    return () => logger.unmount();
  }, [documentId, jobId, logger]);

  // Reset hasAttempted when documentId or jobId changes
  useEffect(() => {
    if (!documentId && !jobId) {
      return;
    }
    setHasAttempted(false);
  }, [documentId, jobId]);

  useEffect(() => {
    if (!documentId && !jobId) {
      logger.warn("Neither documentId nor jobId provided");
      setState({ status: "unavailable", error: "No document ID or job ID provided" });
      return;
    }

    // Only generate if we haven't attempted yet
    if (!hasAttempted) {
      setHasAttempted(true);
      generateExcelFile();
    }
  }, [documentId, jobId, hasAttempted, generateExcelFile, logger]);

  const handleDownloadClick = () => {
    if (state.status === "ready" && state.downloadUrl) {
      logger.userAction("excel_download_clicked", {
        filename: state.filename,
        downloadUrl: state.downloadUrl,
      });
    }
  };

  const handleRetryClick = () => {
    logger.userAction("excel_retry_clicked", { documentId, jobId });
    setHasAttempted(false);
    // Don't call generateExcelFile directly, let the useEffect handle it
  };

  const getButtonText = () => {
    switch (state.status) {
      case "generating":
        return "Generuje se...";
      case "preparing":
        return "Excel se připravuje...";
      case "ready":
        return "Stáhnout Excel";
      case "unavailable":
        return "Zkusit znovu";
      default:
        return "Stáhnout Excel";
    }
  };

  const getButtonTitle = () => {
    if (state.error) {
      return state.error;
    }
    switch (state.status) {
      case "generating":
        return "Excel soubor se právě generuje";
      case "preparing":
        return "Excel soubor se připravuje ke stažení";
      case "ready":
        return "Klikněte pro stažení Excel souboru";
      case "unavailable":
        return "Klikněte pro opakování generování Excel souboru";
      default:
        return "Excel download button";
    }
  };

  const isButtonDisabled = disabled || (state.status !== "ready" && state.status !== "unavailable");
  const isLoading = state.status === "generating" || state.status === "preparing";
  const buttonOpacity = isButtonDisabled ? "opacity-50" : "opacity-100";
  const pointerEvents = isButtonDisabled ? "pointer-events-none" : "pointer-events-auto";

  return (
    <a
      id={linkId}
      href={state.status === "ready" ? state.downloadUrl : "#"}
      download={state.status === "ready" ? state.filename : undefined}
      onClick={state.status === "unavailable" ? handleRetryClick : handleDownloadClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors ${buttonOpacity} ${pointerEvents} ${className}`}
      aria-disabled={isButtonDisabled}
      aria-busy={isLoading}
      title={getButtonTitle()}
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      <span id={textId}>{getButtonText()}</span>
    </a>
  );
};

export default ExcelDownloadButton;
