import { Loader2 } from "lucide-react";

interface ProcessingOverlayProps {
  isVisible: boolean;
}

export function ProcessingOverlay({ isVisible }: ProcessingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-background rounded-lg p-8 max-w-md mx-4 text-center shadow-xl border">
        <div className="w-16 h-16 mx-auto mb-4 relative flex items-center justify-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Nahrávám soubor</h3>
        <p className="text-muted-foreground">Čekejte prosím...</p>
      </div>
    </div>
  );
}
