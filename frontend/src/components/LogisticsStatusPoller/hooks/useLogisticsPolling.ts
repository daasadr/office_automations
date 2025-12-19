import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/utils";
import type { LogisticsStatusData } from "../types";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes max

interface UseLogisticsPollingParams {
  jobId?: string;
}

interface UseLogisticsPollingResult {
  statusData: LogisticsStatusData | null;
  isPolling: boolean;
  error: string | null;
}

export function useLogisticsPolling({
  jobId,
}: UseLogisticsPollingParams): UseLogisticsPollingResult {
  const [statusData, setStatusData] = useState<LogisticsStatusData | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_pollCount, setPollCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!jobId) {
      setError("No job ID provided");
      setIsPolling(false);
      return;
    }

    try {
      const response = await fetch(withBasePath(`/api/logistics-status/${jobId}`));

      if (!response.ok) {
        if (response.status === 404) {
          setError("Job not found");
          setIsPolling(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data: LogisticsStatusData = await response.json();
      setStatusData(data);

      // Stop polling if completed or failed
      if (data.status === "completed" || data.status === "failed") {
        setIsPolling(false);
        if (data.status === "failed" && data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error("Failed to fetch logistics status:", err);
      // Don't stop polling on transient errors
    }
  }, [jobId]);

  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    fetchStatus();

    // Set up polling
    const intervalId = setInterval(() => {
      setPollCount((prev) => {
        if (prev >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false);
          setError("Processing timeout. Please refresh to check status.");
          return prev;
        }
        fetchStatus();
        return prev + 1;
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchStatus, isPolling]);

  return { statusData, isPolling, error };
}
