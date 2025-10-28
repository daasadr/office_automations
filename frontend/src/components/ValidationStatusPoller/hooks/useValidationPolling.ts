import { useState, useEffect, useRef } from "react";
import { useLogger } from "@/lib/client-logger";
import type { ValidationData } from "../types";
import { withBasePath } from "@/lib/utils";

interface UseValidationPollingProps {
  documentId?: string;
  jobId?: string;
}

export function useValidationPolling({ documentId, jobId }: UseValidationPollingProps) {
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
        const url = documentId
          ? withBasePath(`/api/status-by-source/${documentId}`)
          : withBasePath(`/api/status/${jobId}`);

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();

          // Log raw data for debugging
          log.info("Received response data", {
            hasData: !!data,
            hasValidationResult: !!data.validationResult,
            dataKeys: data ? Object.keys(data) : [],
          });

          // Check if we have complete validation data
          // Need to handle both null and undefined, and ensure arrays are valid
          if (
            data.validationResult &&
            typeof data.validationResult === "object" &&
            Array.isArray(data.validationResult.present) &&
            Array.isArray(data.validationResult.missing) &&
            typeof data.validationResult.confidence === "number"
          ) {
            log.info("Valid validation data received - stopping polling", {
              hasPresent: !!data.validationResult.present,
              hasMissing: !!data.validationResult.missing,
              hasConfidence: typeof data.validationResult.confidence !== "undefined",
              dataStructure: {
                present: data.validationResult.present?.length,
                missing: data.validationResult.missing?.length,
                confidence: data.validationResult.confidence,
                hasExtractedData: !!data.validationResult.extracted_data,
                extractedDataLength: data.validationResult.extracted_data?.length,
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
              validationResultType: data.validationResult
                ? typeof data.validationResult
                : "undefined",
              presentType: data.validationResult?.present
                ? `${typeof data.validationResult.present} ${Array.isArray(data.validationResult.present) ? "(array)" : ""}`
                : "undefined",
              missingType: data.validationResult?.missing
                ? `${typeof data.validationResult.missing} ${Array.isArray(data.validationResult.missing) ? "(array)" : ""}`
                : "undefined",
              confidenceType: data.validationResult?.confidence
                ? typeof data.validationResult.confidence
                : "undefined",
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

  // Debug logging
  useEffect(() => {
    if (validationData) {
      log.info("ValidationData is set, should show results now", {
        hasPresent: !!validationData.validationResult?.present,
        hasMissing: !!validationData.validationResult?.missing,
        hasConfidence: !!validationData.validationResult?.confidence,
      });
    }
  }, [validationData, log]);

  return { validationData, isPolling };
}
