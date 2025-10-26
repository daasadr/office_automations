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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Kontrola dokumentu</h1>
        <p className="text-lg text-muted-foreground">Výsledky analýzy vašeho PDF dokumentu</p>
      </div>
      <ValidationResults
        present={validationData.validationResult.present}
        missing={validationData.validationResult.missing}
        confidence={validationData.validationResult.confidence}
      />

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
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
  );
}
