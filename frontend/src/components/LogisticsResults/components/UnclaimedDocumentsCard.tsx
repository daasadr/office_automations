import { AlertTriangle, FileQuestion } from "lucide-react";
import type { UnclaimedDocument } from "../types";

interface UnclaimedDocumentsCardProps {
  documents?: UnclaimedDocument[];
}

export function UnclaimedDocumentsCard({ documents }: UnclaimedDocumentsCardProps) {
  if (!documents || documents.length === 0) {
    return null;
  }

  return (
    <div className="border border-yellow-200 dark:border-yellow-900 rounded-lg overflow-hidden">
      <div className="bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
          Nepřiřazené dokumenty ({documents.length})
        </h3>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Následující dokumenty nebyly přiřazeny k žádné položce faktury:
        </p>

        <div className="grid gap-2">
          {documents.map((doc, index) => (
            <div
              key={`${doc.source_page_index ?? index}-${doc.document_type ?? ""}`}
              className="flex items-start gap-3 p-3 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-md"
            >
              <FileQuestion className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{doc.document_type || "Neznámý dokument"}</span>
                  {doc.source_page_index && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900 px-2 py-0.5 rounded">
                      Strana {doc.source_page_index}
                    </span>
                  )}
                </div>

                {doc.content_summary && (
                  <p className="text-sm text-muted-foreground mt-1">{doc.content_summary}</p>
                )}

                {doc.reason_for_unclaimed && (
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 italic">
                    Důvod: {doc.reason_for_unclaimed}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
