import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  error: string;
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-900 dark:text-red-100">Zpracování selhalo</h4>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</p>
        </div>
      </div>

      <div className="space-y-2 p-4 bg-muted rounded-lg">
        <h4 className="font-semibold text-sm">Možné příčiny:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>V Directus nebyl nalezen žádný schválený zakládací dokument</li>
          <li>Schválený dokument nemá připojený Excel soubor</li>
          <li>Názvy listů neodpovídají očekávanému formátu (kód odpadu + IČO)</li>
          <li>V dokumentu chybí požadované záhlaví sloupců</li>
        </ul>
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Pro opakování:</strong> Obnovte stránku (F5) a dokument bude automaticky zpracován
          znovu.
        </p>
      </div>
    </div>
  );
}
