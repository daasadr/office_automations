import { CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';

interface ExtractedData {
  druh_odpadu?: string;
  kategorie_odpadu?: string;
  mnozstvi_odpadu?: string;
  zpusob_nakládání?: string;
  datum_vzniku?: string;
  identifikace_prijemce?: string;
  přepravce_odpadu?: string;
  doklady_spojené_s_odpadem?: string;
  identifikační_čísla_zařízení?: string;
}

interface ValidationResultsProps {
  present: string[];
  missing: string[];
  confidence: number;
  imagePreview?: string;
  extractedData?: ExtractedData[];
}

export function ValidationResults({ present, missing, confidence, imagePreview, extractedData }: ValidationResultsProps) {
  return (
    <div className="space-y-6">
      {/* Confidence Score */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="text-2xl font-semibold">
          Úspěšnost kontroly: {confidence.toFixed(1)}%
        </div>
        {confidence >= 80 ? (
          <CheckCircle className="w-8 h-8 text-green-500" />
        ) : confidence >= 50 ? (
          <AlertCircle className="w-8 h-8 text-yellow-500" />
        ) : (
          <XCircle className="w-8 h-8 text-red-500" />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Present Items */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Nalezené informace
          </h3>
          <ul className="space-y-2">
            {present.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Missing Items */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Chybějící informace
          </h3>
          <ul className="space-y-2">
            {missing.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Extracted Data */}
      {extractedData && extractedData.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Extrahovaná data z dokumentu
            <span className="text-sm font-normal text-muted-foreground">
              ({extractedData.length} {extractedData.length === 1 ? 'záznam' : extractedData.length < 5 ? 'záznamy' : 'záznamů'})
            </span>
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {extractedData.map((data, index) => (
              <div key={index} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h4 className="font-medium">Záznam {index + 1}</h4>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.druh_odpadu && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Druh odpadu</dt>
                        <dd className="mt-1 text-sm">{data.druh_odpadu}</dd>
                      </div>
                    )}
                    {data.kategorie_odpadu && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Kategorie odpadu</dt>
                        <dd className="mt-1 text-sm">{data.kategorie_odpadu}</dd>
                      </div>
                    )}
                    {data.mnozstvi_odpadu && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Množství odpadu</dt>
                        <dd className="mt-1 text-sm">{data.mnozstvi_odpadu}</dd>
                      </div>
                    )}
                    {data.zpusob_nakládání && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Způsob nakládání</dt>
                        <dd className="mt-1 text-sm">{data.zpusob_nakládání}</dd>
                      </div>
                    )}
                    {data.datum_vzniku && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Datum vzniku</dt>
                        <dd className="mt-1 text-sm">{data.datum_vzniku}</dd>
                      </div>
                    )}
                    {data.identifikace_prijemce && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Identifikace příjemce</dt>
                        <dd className="mt-1 text-sm">{data.identifikace_prijemce}</dd>
                      </div>
                    )}
                    {data.přepravce_odpadu && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Přepravce odpadu</dt>
                        <dd className="mt-1 text-sm">{data.přepravce_odpadu}</dd>
                      </div>
                    )}
                    {data.doklady_spojené_s_odpadem && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Doklady spojené s odpadem</dt>
                        <dd className="mt-1 text-sm">{data.doklady_spojené_s_odpadem}</dd>
                      </div>
                    )}
                    {data.identifikační_čísla_zařízení && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Identifikační čísla zařízení</dt>
                        <dd className="mt-1 text-sm">{data.identifikační_čísla_zařízení}</dd>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Náhled zpracované stránky</h3>
          <div className="border rounded-lg overflow-hidden">
            <img 
              src={imagePreview} 
              alt="Náhled zpracované stránky" 
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
