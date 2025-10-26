import type { UploadResult, UploadError } from "@/components/UploadForm/types";
import type { useLogger } from "@/lib/client-logger";
import { withBasePath } from "@/lib/utils";

type Logger = ReturnType<typeof useLogger>;

const UPLOAD_ENDPOINT = withBasePath("/api/validate-pdf");

export async function uploadFile(file: File, log: Logger): Promise<UploadResult> {
  const startTime = Date.now();
  const formData = new FormData();
  formData.append("file", file);

  log.info("Starting file upload", {
    filename: file.name,
    endpoint: UPLOAD_ENDPOINT,
  });

  try {
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error: UploadError = await response.json();
      const errorMessage = error.error || "Chyba při zpracování souboru";

      log.error("Upload failed", new Error(errorMessage), {
        filename: file.name,
        statusCode: response.status,
        duration,
        requestId: error.requestId,
        details: error.details,
      });

      throw new Error(errorMessage);
    }

    const result: UploadResult = await response.json();

    log.info("Upload completed successfully", {
      filename: file.name,
      duration,
      jobId: result.jobId,
      directusSourceDocumentId: result.directusSourceDocumentId,
      requestId: result.requestId,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    log.error("Upload error occurred", error instanceof Error ? error : new Error(String(error)), {
      filename: file.name,
      duration,
    });

    throw error;
  }
}

export function buildRedirectUrl(result: UploadResult): string {
  // Redirect to check page with document UUID (persists after restart)
  // Fall back to job ID if document UUID is not available
  const redirectParam = result.directusSourceDocumentId
    ? `doc=${result.directusSourceDocumentId}`
    : `job=${result.jobId}`;
  return withBasePath(`/check?${redirectParam}`);
}
