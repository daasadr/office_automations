import { AlertCircle } from "lucide-react";

interface DuplicateRecord {
  date: string;
  wasteAmount: string;
  sheetName: string;
}

interface DuplicatesWarningProps {
  duplicates: DuplicateRecord[];
}

export function DuplicatesWarning({ duplicates }: DuplicatesWarningProps) {
  if (!duplicates || duplicates.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            Duplikáty přeskočeny
          </h4>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            {duplicates.length} záznamů bylo přeskočeno, protože stejné datum a množství odpadu již
            v dokumentu existují:
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {duplicates.map((dup, idx) => (
              <div
                key={`${dup.sheetName}-${dup.date}-${dup.wasteAmount}-${idx}`}
                className="text-xs p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700"
              >
                <span className="font-medium">{dup.sheetName}:</span> {dup.date} • {dup.wasteAmount}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
