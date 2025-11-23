import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ValidationResultsProps {
  present_fields: string[];
  missing_fields: string[];
  confidence: number;
}

export function ValidationResults({
  present_fields,
  missing_fields,
  confidence,
}: ValidationResultsProps) {
  // Defensive checks - ensure arrays are valid
  const safePresent = Array.isArray(present_fields) ? present_fields : [];
  const safeMissing = Array.isArray(missing_fields) ? missing_fields : [];
  const safeConfidence =
    typeof confidence === "number" && !Number.isNaN(confidence) ? confidence : 0;

  return (
    <div className="space-y-6">
      {/* Confidence Score */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="text-2xl font-semibold">
          Úplnost dokumentu: {safeConfidence.toFixed(1)}%
        </div>
        {safeConfidence >= 80 ? (
          <CheckCircle className="w-8 h-8 text-green-500" />
        ) : safeConfidence >= 50 ? (
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
            {safePresent.length > 0 ? (
              safePresent.map((item, index) => (
                <li key={`present-${index}-${item}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Žádné informace nalezeny</li>
            )}
          </ul>
        </div>

        {/* Missing Items */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Chybějící informace
          </h3>
          <ul className="space-y-2">
            {safeMissing.length > 0 ? (
              safeMissing.map((item, index) => (
                <li key={`missing-${index}-${item}`} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Vše nalezeno</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
