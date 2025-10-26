import { useValidationPolling } from "./hooks/useValidationPolling";
import { useDownloadUrl } from "./hooks/useDownloadUrl";
import { LoadingState } from "./components/LoadingState";
import { ResultsState } from "./components/ResultsState";
import type { ValidationStatusPollerProps } from "./types";

export function ValidationStatusPoller({ documentId, jobId }: ValidationStatusPollerProps) {
  const { validationData } = useValidationPolling({ documentId, jobId });
  const downloadUrl = useDownloadUrl({ validationData, documentId, jobId });

  if (!validationData) {
    return <LoadingState />;
  }

  return <ResultsState validationData={validationData} downloadUrl={downloadUrl} />;
}
