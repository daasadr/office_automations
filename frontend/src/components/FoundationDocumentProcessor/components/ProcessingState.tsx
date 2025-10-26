import { Loader2 as DocumentSpinner } from "lucide-react";

export function ProcessingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
        <DocumentSpinner className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">
            Zpracovávám zakládací dokument...
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            Probíhá augmentace schváleného dokumentu extrahovanými daty
          </p>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg space-y-2">
        <h4 className="font-semibold text-sm">Proces augmentace:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Načítání posledního schváleného zakládacího dokumentu</li>
          <li>Vyhledávání listů odpovídajících kódům odpadů a IČO</li>
          <li>Přidávání extrahovaných dat do příslušných řádků</li>
          <li>Ukládání jako nový koncept pro kontrolu</li>
        </ul>
      </div>
    </div>
  );
}
