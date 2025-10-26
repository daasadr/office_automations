import type { FileValidationResult } from "@/components/UploadForm/types";
import type { useLogger } from "@/lib/client-logger";

type Logger = ReturnType<typeof useLogger>;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPE = "application/pdf";

export function validateFile(file: File, log: Logger): FileValidationResult {
  // Check file type
  if (file.type !== ALLOWED_FILE_TYPE) {
    log.warn("Invalid file type selected", {
      filename: file.name,
      fileType: file.type,
      expected: ALLOWED_FILE_TYPE,
    });
    return {
      isValid: false,
      errorMessage: "Prosím vyberte pouze PDF soubory.",
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    log.warn("File too large selected", {
      filename: file.name,
      fileSize: file.size,
      maxSize: MAX_FILE_SIZE,
    });
    return {
      isValid: false,
      errorMessage: "Soubor je příliš velký. Maximální velikost je 10MB.",
    };
  }

  return { isValid: true };
}

export function formatFileSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}
