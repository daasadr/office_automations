import { CheckCircle } from "lucide-react";

interface StatusUpdateMessageProps {
  status: "approved" | "rejected";
}

export function StatusUpdateMessage({ status }: StatusUpdateMessageProps) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg ${
        status === "approved"
          ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
          : "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900"
      }`}
    >
      <CheckCircle
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          status === "approved"
            ? "text-green-600 dark:text-green-400"
            : "text-orange-600 dark:text-orange-400"
        }`}
      />
      <div className="flex-1">
        <h4
          className={`font-semibold ${
            status === "approved"
              ? "text-green-900 dark:text-green-100"
              : "text-orange-900 dark:text-orange-100"
          }`}
        >
          {status === "approved" ? "Dokument schválen!" : "Dokument odmítnut"}
        </h4>
        <p
          className={`text-sm mt-1 ${
            status === "approved"
              ? "text-green-800 dark:text-green-200"
              : "text-orange-800 dark:text-orange-200"
          }`}
        >
          {status === "approved"
            ? "Zakládací dokument byl úspěšně schválen a je nyní aktivní."
            : "Zakládací dokument byl odmítnut a zůstává jako koncept."}
        </p>
      </div>
    </div>
  );
}
