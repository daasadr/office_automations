import { Loader2 as ApprovalSpinner, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApprovalActionsProps {
  onApprove: () => void;
  onReject: () => void;
  isUpdating: boolean;
}

export function ApprovalActions({ onApprove, onReject, isUpdating }: ApprovalActionsProps) {
  return (
    <div className="space-y-3">
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Zkontrolujte změny a potvrďte
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Stáhněte si dokument, zkontrolujte doplněná data a pokud jsou správná, schvalte dokument.
          Tím dojde k uložení změn do dokumentu na serveru. V případě chyb dokument odmítněte a
          obnovte stránku pro nové vygenerování.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onApprove}
          disabled={isUpdating}
          aria-busy={isUpdating}
          size="lg"
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          {isUpdating ? (
            <>
              <ApprovalSpinner className="mr-2 h-4 w-4 animate-spin" />
              Zpracovávám...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Schválit změny
            </>
          )}
        </Button>

        <Button
          onClick={onReject}
          disabled={isUpdating}
          aria-busy={isUpdating}
          size="lg"
          variant="destructive"
          className="flex-1"
        >
          {isUpdating ? (
            <>
              <ApprovalSpinner className="mr-2 h-4 w-4 animate-spin" />
              Zpracovávám...
            </>
          ) : (
            <>
              <X className="mr-2 h-4 w-4" />
              Odmítnout
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
