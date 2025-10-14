import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadSectionProps {
  onDownload: () => void;
  isDownloading: boolean;
}

export function DownloadSection({ onDownload, isDownloading }: DownloadSectionProps) {
  return (
    <div className="p-4 border-2 border-primary/20 bg-primary/5 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-semibold mb-1">Stáhnout augmentovaný dokument</h4>
          <p className="text-sm text-muted-foreground">
            Před schválením si prosím stáhněte dokument a zkontrolujte změny
          </p>
        </div>
        <Button onClick={onDownload} disabled={isDownloading} size="lg" variant="default">
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Stahuji...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Stáhnout dokument
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
