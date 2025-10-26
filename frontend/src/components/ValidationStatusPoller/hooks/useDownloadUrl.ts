import type { ValidationData } from "../types";

interface UseDownloadUrlProps {
  validationData: ValidationData | null;
  documentId?: string;
  jobId?: string;
}

export function useDownloadUrl({ validationData, documentId, jobId }: UseDownloadUrlProps) {
  const sourceDocumentId = validationData?.directusSourceDocumentId || documentId;
  const downloadUrl = sourceDocumentId
    ? `/download?doc=${sourceDocumentId}`
    : `/download?job=${jobId}`;

  return downloadUrl;
}
