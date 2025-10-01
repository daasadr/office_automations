import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ValidationResultsProps {
  present: string[];
  missing: string[];
  confidence: number;
}

export function ValidationResults({ present, missing, confidence }: ValidationResultsProps) {
  return (
    <div className="space-y-6">
      {/* Confidence Score */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="text-2xl font-semibold">Úplnost dokumentu: {confidence.toFixed(1)}%</div>
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
    </div>
  );
}
