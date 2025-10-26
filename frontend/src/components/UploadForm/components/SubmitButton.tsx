import { Loader2, Upload } from "lucide-react";

interface SubmitButtonProps {
  isSubmitting: boolean;
  disabled: boolean;
}

export function SubmitButton({ isSubmitting, disabled }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={isSubmitting}
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8 min-w-40"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Zpracovávám data...
        </>
      ) : (
        <>
          <Upload className="mr-2 h-4 w-4" />
          Nahrát a zpracovat
        </>
      )}
    </button>
  );
}
