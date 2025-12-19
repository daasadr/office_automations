import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/utils";
import type { LogisticsDocumentData } from "../types";

interface UseLogisticsDocumentParams {
  documentId?: string;
}

interface UseLogisticsDocumentResult {
  document: LogisticsDocumentData | null;
  isLoading: boolean;
  error: string | null;
}

export function useLogisticsDocument({
  documentId,
}: UseLogisticsDocumentParams): UseLogisticsDocumentResult {
  const [document, setDocument] = useState<LogisticsDocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setError("No document ID provided");
      setIsLoading(false);
      return;
    }

    async function fetchDocument() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch from backend via frontend API
        const response = await fetch(withBasePath(`/api/logistics-document/${documentId}`));

        if (!response.ok) {
          if (response.status === 404) {
            setError("Dokument nebyl nalezen");
          } else {
            setError("Nepodařilo se načíst dokument");
          }
          return;
        }

        const data: LogisticsDocumentData = await response.json();
        setDocument(data);
      } catch (err) {
        console.error("Failed to fetch logistics document:", err);
        setError("Chyba při načítání dokumentu");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocument();
  }, [documentId]);

  return { document, isLoading, error };
}
