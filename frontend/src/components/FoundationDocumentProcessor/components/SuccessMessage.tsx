import { CheckCircle } from "lucide-react";

export function SuccessMessage() {
  return (
    <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-green-900 dark:text-green-100">
          Zakládací dokument úspěšně zpracován!
        </h4>
        <p className="text-sm text-green-800 dark:text-green-200">
          Nový koncept zakládacího dokumentu byl vytvořen a uložen do Directus.
        </p>
      </div>
    </div>
  );
}
