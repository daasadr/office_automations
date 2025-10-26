import { useRef } from "react";
import { CheckCircle, Upload } from "lucide-react";
import { formatFileSize } from "@/components/UploadForm/actions/fileValidation";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  selectedFile: File | null;
  dragOver: boolean;
  onFileSelect: (file: File) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function FileDropZone({
  selectedFile,
  dragOver,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAreaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: File drop zone needs click and keyboard interactions */
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        dragOver && "border-primary bg-primary/10",
        !dragOver && selectedFile && "border-primary bg-primary/5",
        !dragOver &&
          !selectedFile &&
          "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
      )}
      onClick={handleAreaClick}
      onKeyDown={handleAreaClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
                {selectedFile.name} ({formatFileSize(selectedFile.size)} MB)
              </p>
              <p className="text-xs text-muted-foreground">Klikněte pro výběr jiného souboru</p>
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
  );
}
