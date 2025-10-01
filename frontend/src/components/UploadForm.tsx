import { useState, useRef, useCallback } from "react";
import { CheckCircle, Upload, Loader2 } from "lucide-react";
import { ProcessingOverlay } from "./ProcessingOverlay";
import { useLogger } from "../lib/client-logger";

export function UploadForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const log = useLogger("UploadForm");

  const handleFileSelect = useCallback(
    (file: File) => {
      log.userAction("file_selected", {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      if (file.type !== "application/pdf") {
        log.warn("Invalid file type selected", {
          filename: file.name,
          fileType: file.type,
          expected: "application/pdf",
        });
        alert("Prosím vyberte pouze PDF soubory.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        log.warn("File too large selected", {
          filename: file.name,
          fileSize: file.size,
          maxSize: 10 * 1024 * 1024,
        });
        alert("Soubor je příliš velký. Maximální velikost je 10MB.");
        return;
      }
      setSelectedFile(file);
    },
    [log]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleAreaClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      log.info("Starting file upload", {
        filename: selectedFile.name,
        endpoint: "/api/validate-pdf",
      });

      const response = await fetch("/api/validate-pdf", {
        method: "POST",
        body: formData,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || "Chyba při zpracování souboru";

        log.error("Upload failed", new Error(errorMessage), {
          filename: selectedFile.name,
          statusCode: response.status,
          duration,
          requestId: error.requestId,
          details: error.details,
        });

        throw new Error(errorMessage);
      }

      const result = await response.json();

      log.info("Upload completed successfully", {
        filename: selectedFile.name,
        duration,
        jobId: result.jobId,
        requestId: result.requestId,
      });

      // Redirect to check page with job ID
      window.location.href = `/check?job=${result.jobId}`;
    } catch (error) {
      const duration = Date.now() - startTime;

      log.error(
        "Upload error occurred",
        error instanceof Error ? error : new Error(String(error)),
        {
          filename: selectedFile.name,
          duration,
        }
      );

      alert(
        error instanceof Error
          ? error.message
          : "Došlo k neočekávané chybě. Prosím zkuste to znovu."
      );
      setIsSubmitting(false);
      setShowProcessing(false);
    }
  };

  const handleCloseProcessing = () => {
    setShowProcessing(false);
    setIsSubmitting(false);
  };

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-6"
        encType="multipart/form-data"
      >
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: File drop zone needs click and keyboard interactions */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/10"
                : selectedFile
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
            }`}
            onClick={handleAreaClick}
            onKeyDown={handleAreaClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 text-muted-foreground">
                {selectedFile ? (
                  <CheckCircle className="w-full h-full text-primary" />
                ) : (
                  <Upload className="w-full h-full" />
                )}
              </div>
              <div className="space-y-2">
                {selectedFile ? (
                  <>
                    <p className="text-lg font-medium text-primary">Soubor vybrán</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Klikněte pro výběr jiného souboru
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      <strong>Klikněte pro nahrání</strong> nebo přetáhněte soubor
                    </p>
                    <p className="text-sm text-muted-foreground">PDF soubory do 10MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8 min-w-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zpracovávám data...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Nahrát a zpracovat
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <ProcessingOverlay isVisible={showProcessing} onClose={handleCloseProcessing} />
    </>
  );
}
