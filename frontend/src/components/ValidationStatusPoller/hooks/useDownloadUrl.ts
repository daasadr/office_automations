import { generateUrl } from "@/lib/utils";
import type { ValidationData } from "../types";

interface UseDownloadUrlProps {
  validationData: ValidationData | null;
  documentId?: string;
  jobId?: string;
}

export function useDownloadUrl({ validationData, documentId, jobId }: UseDownloadUrlProps) {
  const sourceDocumentId = validationData?.directusSourceDocumentId || documentId;
  const downloadUrl = sourceDocumentId
    ? generateUrl("/kvalita/download", { doc: sourceDocumentId })
    : generateUrl("/kvalita/download", { job: jobId });

  return downloadUrl;
}
