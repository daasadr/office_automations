import { Badge } from "@/components/ui/badge";

interface ProcessingStatisticsProps {
  recordsAdded: number;
  extractedDataCount: number;
  confidence: number;
  sheetsModified: string[];
}

export function ProcessingStatistics({
  recordsAdded,
  extractedDataCount,
  confidence,
  sheetsModified,
}: ProcessingStatisticsProps) {
  return (
    <div className="p-4 border rounded-lg space-y-3">
      <h4 className="font-semibold">Detaily zpracování</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-2xl font-bold text-primary">{recordsAdded || 0}</div>
          <div className="text-sm text-muted-foreground">Přidaných záznamů</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-primary">{extractedDataCount}</div>
          <div className="text-sm text-muted-foreground">Typů odpadu (kódů)</div>
        </div>
      </div>

      {sheetsModified.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-sm font-medium mb-2">Upravené listy:</div>
          <div className="flex flex-wrap gap-2">
            {sheetsModified.map((sheet) => (
              <Badge key={sheet} variant="secondary">
                {sheet}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
