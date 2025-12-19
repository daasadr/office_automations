import { AlertTriangle, ArrowRight, CloudUpload, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationResults } from "@/components/ValidationResults";
import { withBasePath } from "@/lib/utils";
import type { ValidationData } from "../types";
import { ExtractedDataPreview } from "./ExtractedDataPreview";

interface ResultsStateProps {
  validationData: ValidationData;
  downloadUrl: string;
}

export function ResultsState({ validationData, downloadUrl }: ResultsStateProps) {
  const extractedData = validationData.validationResult.extracted_data;
  const totalRecords =
    extractedData?.reduce((sum: number, data) => sum + (data.records?.length || 0), 0) || 0;

  // Check if document contains necessary data
  const hasNecessaryData = extractedData?.some((data) => {
    const hasWasteCode = !!data.waste_code;
    const hasRecipientCompanyId = !!data.recipient?.company_id;
    const hasWasteAmount = data.records?.some(
      (record) =>
        (record.waste_amount_generated !== null && record.waste_amount_generated !== undefined) ||
        (record.waste_amount_transferred !== null && record.waste_amount_transferred !== undefined)
    );

    return hasWasteCode && hasRecipientCompanyId && hasWasteAmount;
  });

  // Determine what's missing
  const getMissingFields = () => {
    const missing: string[] = [];

    const hasAnyWasteCode = extractedData?.some((data) => !!data.waste_code);
    const hasAnyRecipientCompanyId = extractedData?.some((data) => !!data.recipient?.company_id);
    const hasAnyWasteAmount = extractedData?.some((data) =>
      data.records?.some(
        (record) =>
          (record.waste_amount_generated !== null && record.waste_amount_generated !== undefined) ||
          (record.waste_amount_transferred !== null &&
            record.waste_amount_transferred !== undefined)
      )
    );

    if (!hasAnyWasteCode) missing.push("kód odpadu");
    if (!hasAnyWasteAmount) missing.push("množství odpadu");
    if (!hasAnyRecipientCompanyId) missing.push("IČO nakládající společnosti (odběratel)");

    return missing;
  };

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
            present_fields={validationData.validationResult.present_fields}
            missing_fields={validationData.validationResult.missing_fields}
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
        <div className="flex flex-col gap-4 justify-center items-center max-w-4xl mx-auto px-4">
          {!hasNecessaryData && extractedData && extractedData.length > 0 && (
            <div className="w-full bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Dokument neobsahuje všechna potřebná data
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    Pro pokračování ve zpracování musí dokument obsahovat:
                  </p>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-200 list-disc list-inside space-y-1">
                    {getMissingFields().map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-3">
                    Prosím nahrajte dokument, který obsahuje všechny tyto údaje.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
            <Button asChild variant="secondary" size="lg" className="min-w-48">
              <a href={withBasePath("/upload")}>
                <CloudUpload className="w-5 h-5" />
                Nahrát jiný dokument
              </a>
            </Button>

            {hasNecessaryData && (
              <Button asChild size="lg" className="min-w-48 shadow-lg hover:shadow-xl">
                <a href={downloadUrl}>
                  <ArrowRight className="w-5 h-5" />
                  Pokračovat ve zpracování
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
