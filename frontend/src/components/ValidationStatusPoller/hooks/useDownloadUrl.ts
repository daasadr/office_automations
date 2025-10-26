import type { ValidationData } from "../types";
import { generateUrl } from "@/lib/utils";

interface UseDownloadUrlProps {
  validationData: ValidationData | null;
  documentId?: string;
  jobId?: string;
}

export function useDownloadUrl({ validationData, documentId, jobId }: UseDownloadUrlProps) {
  const sourceDocumentId = validationData?.directusSourceDocumentId || documentId;
  const downloadUrl = sourceDocumentId
    ? generateUrl("/download", { doc: sourceDocumentId })
    : generateUrl("/download", { job: jobId });

  return downloadUrl;
}
