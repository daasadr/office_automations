import { ChevronLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/utils";
import { ProcessingSteps } from "./ProcessingSteps";

export function LoadingState() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Zpracovávání dokumentu</h1>
        <p className="text-lg text-muted-foreground">Probíhá zpracování dokumentu pomocí AI.</p>
      </div>
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-8">
        <div className="text-center space-y-6">
          {/* Animated spinner */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Status message */}
          <div>
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">
              Analyzuji dokument...
            </h2>
            <p className="text-blue-800 dark:text-blue-200">
              Používám AI pro extrakci dat z PDF dokumentu
            </p>
          </div>

          {/* Progress steps */}
          <ProcessingSteps />

          {/* Info text */}
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p>Toto může trvat 30-90 sekund v závislosti na velikosti dokumentu.</p>
            <p className="text-xs">Stránka se automaticky aktualizuje každé 2 sekundy.</p>
          </div>
        </div>
      </div>

      {/* Alternative actions */}
      <div className="flex justify-center gap-4 mt-8">
        <Button
          asChild
          variant="ghost"
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <a href={withBasePath("/kvalita/upload")}>
            <ChevronLeft className="w-4 h-4" />
            Zpět
          </a>
        </Button>

        {/* <Button
          type="button"
          onClick={() => window.location.reload()}
          variant="secondary"
          className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50"
        >
          <RefreshCw className="w-4 h-4" />
          Obnovit nyní
        </Button> */}
      </div>
    </div>
  );
}
