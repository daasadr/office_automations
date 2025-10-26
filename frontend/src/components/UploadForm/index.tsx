import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { FileDropZone } from "@/components/UploadForm/components/FileDropZone";
import { SubmitButton } from "@/components/UploadForm/components/SubmitButton";
import { useDragAndDrop } from "@/components/UploadForm/hooks/useDragAndDrop";
import { useFileUpload } from "@/components/UploadForm/hooks/useFileUpload";

export function UploadForm() {
  const { selectedFile, isSubmitting, showProcessing, handleFileSelect, handleSubmit } =
    useFileUpload();

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

          <div className="flex justify-center">
            <SubmitButton isSubmitting={isSubmitting} disabled={isSubmitting || !selectedFile} />
          </div>
        </div>
      </form>

      <ProcessingOverlay isVisible={showProcessing} />
    </>
  );
}
