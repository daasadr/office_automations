import { Upload, Loader2 as UploadSpinner } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  isSubmitting: boolean;
  disabled: boolean;
}

export function SubmitButton({ isSubmitting, disabled }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      aria-busy={isSubmitting}
      size="lg"
      className="min-w-40"
    >
      {isSubmitting ? (
        <>
          <UploadSpinner className="mr-2 h-4 w-4 animate-spin" />
          Zpracovávám data...
        </>
      ) : (
        <>
          <Upload className="mr-2 h-4 w-4" />
          Nahrát a zpracovat
        </>
      )}
    </Button>
  );
}
