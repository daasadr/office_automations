import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogger } from "@/lib/client-logger";
import { withBasePath } from "@/lib/utils";

interface FoundationDocument {
  id: string;
  title: string;
  status: "draft" | "in_review" | "approved" | "rejected" | "published";
  doc_type?: string;
  created_at?: string;
  updated_at?: string;
  content_json?: Record<string, unknown>;
  notes?: string;
}

interface FoundationDocumentsResponse {
  success: boolean;
  documents: FoundationDocument[];
  count: number;
  lastApprovedId: string | null;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("cs-CZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function CurrentDocument() {
  const [activeDoc, setActiveDoc] = useState<FoundationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const log = useLogger("CurrentDocument");

  // biome-ignore lint/correctness/useExhaustiveDependencies: log is stable from useLogger hook
  const fetchCurrentDocument = useCallback(async () => {
    log.info("Fetching current foundation document");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/list-foundation"));

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }

      const data: FoundationDocumentsResponse = await response.json();
      log.info("Documents fetched successfully", { count: data.count });

      if (data.lastApprovedId) {
        const current = data.documents.find((doc) => doc.id === data.lastApprovedId);
        setActiveDoc(current || null);
      } else {
        setActiveDoc(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Failed to fetch documents", err instanceof Error ? err : new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentDocument();
  }, [fetchCurrentDocument]);

  const handleDownload = async (documentId: string, title: string) => {
    log.info("Downloading foundation document", { documentId });

    try {
      const response = await fetch(withBasePath(`/api/download-foundation/${documentId}`));

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      log.info("Document downloaded successfully", { documentId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error(
        "Failed to download document",
        err instanceof Error ? err : new Error(errorMessage)
      );
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Načítání dokumentu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <p className="font-medium">Chyba</p>
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {activeDoc ? (
        <Card className="border-primary border-2 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
                role="img"
                aria-label="Aktivní dokument"
              >
                <title>Aktivní dokument</title>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Aktuální dokument pro augmentaci
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{activeDoc.title}</h3>
                    <Badge variant="default" className="bg-green-600">
                      Aktivní
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      <strong>Vytvořeno:</strong> {formatDate(activeDoc.created_at)}
                    </div>
                    {activeDoc.notes && (
                      <div>
                        <strong>Poznámky:</strong> {activeDoc.notes}
                      </div>
                    )}
                  </div>

                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Tento dokument je aktuálně používán pro augmentaci nových dat ze zpracovaných
                      PDF souborů.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleDownload(activeDoc.id, activeDoc.title)}
                  >
                    Stáhnout
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <p className="font-medium">Žádný aktivní dokument</p>
          <p className="text-sm">
            Momentálně není nastaven žádný schválený dokument pro augmentaci. Nahrajte nový dokument
            nebo schvalte některý z existujících dokumentů.
          </p>
        </Alert>
      )}
    </div>
  );
}
