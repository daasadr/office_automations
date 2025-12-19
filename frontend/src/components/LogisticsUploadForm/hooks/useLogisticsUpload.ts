import { useCallback, useState } from "react";
import { useLogger } from "@/lib/client-logger";
import { withBasePath } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for logistics
const ALLOWED_TYPES = ["application/pdf"];

export interface LogisticsUploadResult {
  success: boolean;
  jobId: string;
  logisticsDocumentId?: string;
  isDuplicate?: boolean;
  status: string;
  message: string;
  requestId?: string;
}

interface UploadError {
  error: string;
  requestId?: string;
  details?: string;
}

export interface LogisticsUploadHandlers {
  selectedFile: File | null;
  isSubmitting: boolean;
  showProcessing: boolean;
  handleFileSelect: (file: File) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

function validateFile(
  file: File,
  log: ReturnType<typeof useLogger>
): { isValid: boolean; errorMessage?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    log.warn("Invalid file type", { fileType: file.type });
    return {
      isValid: false,
      errorMessage: "Nepodporovaný typ souboru. Prosím nahrajte PDF soubor.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    log.warn("File too large", { fileSize: file.size, maxSize: MAX_FILE_SIZE });
    return {
      isValid: false,
      errorMessage: `Soubor je příliš velký. Maximální velikost je ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  return { isValid: true };
}

export function useLogisticsUpload(): LogisticsUploadHandlers {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const log = useLogger("LogisticsUpload");

  const handleFileSelect = useCallback(
    (file: File) => {
      log.userAction("file_selected", {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      const validation = validateFile(file, log);
      if (!validation.isValid) {
        alert(validation.errorMessage);
        return;
      }

      setSelectedFile(file);
    },
    [log]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (isSubmitting) return;

      if (!selectedFile) {
        log.warn("Submit attempted without file selected");
        alert("Prosím vyberte soubor k nahrání.");
        return;
      }

      log.userAction("form_submit", {
        filename: selectedFile.name,
        fileSize: selectedFile.size,
      });

      setIsSubmitting(true);
      setShowProcessing(true);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch(withBasePath("/api/upload-logistics"), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error: UploadError = await response.json();
          throw new Error(error.error || "Chyba při zpracování souboru");
        }

        const result: LogisticsUploadResult = await response.json();

        log.info("Upload completed", {
          jobId: result.jobId,
          logisticsDocumentId: result.logisticsDocumentId,
          isDuplicate: result.isDuplicate,
        });

        // Redirect to check page
        const redirectParam = result.jobId ? `job=${result.jobId}` : "";
        window.location.href = withBasePath(`/logistika/check?${redirectParam}`);
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Došlo k neočekávané chybě. Prosím zkuste to znovu."
        );
        setIsSubmitting(false);
        setShowProcessing(false);
      }
    },
    [isSubmitting, selectedFile, log]
  );

  return {
    selectedFile,
    isSubmitting,
    showProcessing,
    handleFileSelect,
    handleSubmit,
  };
}
