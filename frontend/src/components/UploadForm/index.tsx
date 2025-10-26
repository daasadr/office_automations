import { ProcessingOverlay } from "../ProcessingOverlay";
import { FileDropZone } from "./components/FileDropZone";
import { SubmitButton } from "./components/SubmitButton";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useFileUpload } from "./hooks/useFileUpload";

export function UploadForm() {
  const {
    selectedFile,
    isSubmitting,
    showProcessing,
    handleFileSelect,
    handleSubmit,
    handleCloseProcessing,
  } = useFileUpload();

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

      <ProcessingOverlay isVisible={showProcessing} onClose={handleCloseProcessing} />
    </>
  );
}
