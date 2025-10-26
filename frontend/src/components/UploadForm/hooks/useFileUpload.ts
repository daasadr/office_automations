import { useState, useCallback } from "react";
import { useLogger } from "@/lib/client-logger";
import { validateFile } from "@/components/UploadForm/actions/fileValidation";
import { uploadFile, buildRedirectUrl } from "@/components/UploadForm/actions/uploadFile";

export interface FileUploadHandlers {
  selectedFile: File | null;
  isSubmitting: boolean;
  showProcessing: boolean;
  handleFileSelect: (file: File) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useFileUpload(): FileUploadHandlers {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const log = useLogger("UploadForm");

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
        const result = await uploadFile(selectedFile, log);
        const redirectUrl = buildRedirectUrl(result);
        window.location.href = redirectUrl;
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
