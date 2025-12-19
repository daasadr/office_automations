import { useCallback, useState } from "react";

export interface DragAndDropHandlers {
  dragOver: boolean;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, onFileDrop: (file: File) => void) => void;
}

export function useDragAndDrop(): DragAndDropHandlers {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, onFileDrop: (file: File) => void) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileDrop(file);
    }
  }, []);

  return {
    dragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
