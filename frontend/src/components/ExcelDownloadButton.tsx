import { useState, useEffect, useCallback, useId, type FC } from "react";
import { useLogger } from "../lib/client-logger";

export interface ExcelDownloadButtonProps {
  jobId: string;
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
  jobId,
  className = "",
  disabled = false,
}) => {
  const [state, setState] = useState<ExcelDownloadState>({ status: "preparing" });
  const logger = useLogger("ExcelDownloadButton");
  const linkId = useId();
  const textId = useId();

  const generateExcelFile = useCallback(async () => {
    logger.info("Starting Excel file generation", { jobId });
    setState({ status: "generating" });

    try {
      // Check if Excel file was already generated and stored in sessionStorage
      const existingData = sessionStorage.getItem(`excel_${jobId}`);
      if (existingData) {
        try {
          const { filename, downloadUrl } = JSON.parse(existingData);
          logger.info("Found existing Excel file in sessionStorage", { filename, downloadUrl });
          setState({
            status: "ready",
            filename,
            downloadUrl,
          });
          return;
        } catch (error) {
          logger.warn("Failed to parse existing Excel data from sessionStorage", undefined, {
            error,
          });
        }
      }

      logger.debug("Making POST request to /api/generate-excel", { jobId });

      const response = await fetch("/api/generate-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
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

        // Store the download URL for later use
        const excelData = {
          filename: result.filename,
          downloadUrl: result.downloadUrl,
          timestamp: Date.now(),
        };

        sessionStorage.setItem(`excel_${jobId}`, JSON.stringify(excelData));
        logger.debug("Excel data stored in sessionStorage", excelData);

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
  }, [jobId, logger]);

  useEffect(() => {
    logger.mount({ jobId });
    return () => logger.unmount();
  }, [jobId, logger]);

  useEffect(() => {
    if (!jobId) {
      logger.warn("No jobId provided");
      setState({ status: "unavailable", error: "No job ID provided" });
      return;
    }

    generateExcelFile();
  }, [jobId, generateExcelFile, logger]);

  const handleDownloadClick = () => {
    if (state.status === "ready" && state.downloadUrl) {
      logger.userAction("excel_download_clicked", {
        filename: state.filename,
        downloadUrl: state.downloadUrl,
      });
    }
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
        return "Excel nedostupný";
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
        return "Excel soubor není k dispozici";
      default:
        return "Excel download button";
    }
  };

  const isButtonDisabled = disabled || state.status !== "ready";
  const buttonOpacity = isButtonDisabled ? "opacity-50" : "opacity-100";
  const pointerEvents = isButtonDisabled ? "pointer-events-none" : "pointer-events-auto";

  return (
    <a
      id={linkId}
      href={state.status === "ready" ? state.downloadUrl : "#"}
      download={state.status === "ready" ? state.filename : undefined}
      onClick={handleDownloadClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors ${buttonOpacity} ${pointerEvents} ${className}`}
      aria-disabled={isButtonDisabled}
      title={getButtonTitle()}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mr-2"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7,10 12,15 17,10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span id={textId}>{getButtonText()}</span>
    </a>
  );
};

export default ExcelDownloadButton;
