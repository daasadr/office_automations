import { Upload } from "lucide-react";
import { useLogisticsUpload } from "@/components/LogisticsUploadForm/hooks/useLogisticsUpload";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { FileDropZone } from "@/components/UploadForm/components/FileDropZone";
import { useDragAndDrop } from "@/components/UploadForm/hooks/useDragAndDrop";

export function LogisticsUploadForm() {
  const { selectedFile, isSubmitting, showProcessing, handleFileSelect, handleSubmit } =
    useLogisticsUpload();

  const { dragOver, handleDragOver, handleDragLeave, handleDrop } = useDragAndDrop();

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <FileDropZone
            selectedFile={selectedFile}
            dragOver={dragOver}
            onFileSelect={handleFileSelect}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, handleFileSelect)}
          />

          <p className="text-sm text-muted-foreground text-center">
            Podporované soubory: PDF (max. 50MB)
          </p>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
            >
              <Upload className="w-5 h-5" />
              {isSubmitting ? "Nahrávám..." : "Nahrát a zpracovat"}
            </button>
          </div>
        </div>
      </form>

      <ProcessingOverlay isVisible={showProcessing} />
    </>
  );
}
