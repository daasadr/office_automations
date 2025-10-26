import { Check } from "lucide-react";

export function ProcessingSteps() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Soubor nahrán
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Zpracování s AI modelem...
          </span>
        </div>
        <div className="flex items-center gap-3 opacity-50">
          <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Validace výsledků</span>
        </div>
      </div>
    </div>
  );
}
