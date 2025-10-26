import { CloudUpload, ArrowRight, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationResults } from "@/components/ValidationResults";
import { ExtractedDataPreview } from "./ExtractedDataPreview";
import type { ValidationData } from "../types";

interface ResultsStateProps {
  validationData: ValidationData;
  downloadUrl: string;
}

export function ResultsState({ validationData, downloadUrl }: ResultsStateProps) {
  const extractedData = validationData.validationResult.extracted_data;
  const totalRecords =
    extractedData?.reduce((sum: number, data) => sum + (data.tabulka?.length || 0), 0) || 0;

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-8 pb-32">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Kontrola dokumentu</h1>
          <p className="text-lg text-muted-foreground">Výsledky analýzy vašeho PDF dokumentu</p>
        </div>

        {/* Validation Results Section */}
        <div>
          <ValidationResults
            present={validationData.validationResult.present}
            missing={validationData.validationResult.missing}
            confidence={validationData.validationResult.confidence}
          />
        </div>

        {/* Extracted Data Preview - Data that will be added to the foundation document */}
        {extractedData && extractedData.length > 0 && (
          <div>
            <div className="sticky top-12 z-30 bg-background/95 backdrop-blur-lg border-b border-border shadow-sm mb-6 -mx-4 px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <Table2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-2xl font-semibold text-foreground">
                  Extrahovaná data z dokumentu
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {extractedData.length}{" "}
                  {extractedData.length === 1
                    ? "typ odpadu"
                    : extractedData.length < 5
                      ? "typy odpadu"
                      : "typů odpadu"}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {totalRecords}{" "}
                  {totalRecords === 1 ? "záznam" : totalRecords < 5 ? "záznamy" : "záznamů"} celkem
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Tato data budou přidána do zakládacího dokumentu
              </p>
            </div>
            <ExtractedDataPreview extractedData={extractedData} />
          </div>
        )}
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
