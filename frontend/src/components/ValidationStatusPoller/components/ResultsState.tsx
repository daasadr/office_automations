import { CloudUpload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationResults } from "@/components/ValidationResults";
import type { ValidationData } from "../types";

interface ResultsStateProps {
  validationData: ValidationData;
  downloadUrl: string;
}

export function ResultsState({ validationData, downloadUrl }: ResultsStateProps) {
  return (
    <>
      <div className="max-w-6xl mx-auto space-y-8 pb-32">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Kontrola dokumentu</h1>
          <p className="text-lg text-muted-foreground">Výsledky analýzy vašeho PDF dokumentu</p>
        </div>
        <ValidationResults
          present={validationData.validationResult.present}
          missing={validationData.validationResult.missing}
          confidence={validationData.validationResult.confidence}
        />
      </div>

      {/* Action Buttons - Sticky at bottom, full width */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border shadow-lg py-6 z-50">
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button asChild variant="secondary" size="lg" className="min-w-48">
            <a href="/upload">
              <CloudUpload className="w-5 h-5" />
              Nahrát jiný dokument
            </a>
          </Button>

          <Button asChild size="lg" className="min-w-48 shadow-lg hover:shadow-xl">
            <a href={downloadUrl}>
              <ArrowRight className="w-5 h-5" />
              Pokračovat ke stažení
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
