import { useState, useEffect, useCallback } from "react";
import { useLogger } from "@/lib/client-logger";
import { withBasePath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

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

const StatusBadge = ({ status }: { status: FoundationDocument["status"] }) => {
  const variants: Record<
    FoundationDocument["status"],
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    approved: { variant: "default", label: "Schváleno" },
    draft: { variant: "secondary", label: "Koncept" },
    in_review: { variant: "outline", label: "Ke kontrole" },
    rejected: { variant: "destructive", label: "Zamítnuto" },
    published: { variant: "default", label: "Publikováno" },
  };

  const config = variants[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

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

export default function DocumentsList() {
  const [documents, setDocuments] = useState<FoundationDocument[]>([]);
  const [lastApprovedId, setLastApprovedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const log = useLogger("DocumentsList");

  // biome-ignore lint/correctness/useExhaustiveDependencies: log is stable from useLogger hook
  const fetchDocuments = useCallback(async () => {
    log.info("Fetching foundation documents");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/list-foundation"));

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }

      const data: FoundationDocumentsResponse = await response.json();
      log.info("Documents fetched successfully", { count: data.count });

      setDocuments(data.documents);
      setLastApprovedId(data.lastApprovedId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Failed to fetch documents", err instanceof Error ? err : new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleStatusChange = async (
    documentId: string,
    newStatus: "approved" | "rejected" | "draft"
  ) => {
    log.info("Updating document status", { documentId, newStatus });
    setUpdatingStatus(documentId);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/update-foundation-status"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foundationDocumentId: documentId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      log.info("Status updated successfully", { documentId, newStatus });

      // Refresh the list
      await fetchDocuments();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Failed to update status", err instanceof Error ? err : new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setUpdatingStatus(null);
    }
  };

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
          <p className="mt-4 text-muted-foreground">Načítání dokumentů...</p>
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

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Všechny dokumenty ({documents.length})</h2>

        {documents.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                Zatím nebyly nahrány žádné zakládající dokumenty.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => {
              const isLastApproved = doc.id === lastApprovedId;
              const isUpdating = updatingStatus === doc.id;

              return (
                <Card key={doc.id} className={isLastApproved ? "border-primary border-2" : ""}>
                  <CardContent className="py-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{doc.title}</h3>
                          <StatusBadge status={doc.status} />
                          {isLastApproved && (
                            <Badge variant="default" className="bg-green-600">
                              Aktuálně používáno
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <strong>Vytvořeno:</strong> {formatDate(doc.created_at)}
                          </div>
                          {doc.updated_at && doc.updated_at !== doc.created_at && (
                            <div>
                              <strong>Aktualizováno:</strong> {formatDate(doc.updated_at)}
                            </div>
                          )}
                          {doc.notes && (
                            <div>
                              <strong>Poznámky:</strong> {doc.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(doc.id, doc.title)}
                        >
                          Stáhnout
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleStatusChange(doc.id, "approved")}
                          disabled={isUpdating || doc.status === "approved"}
                        >
                          {isUpdating ? "Ukládám..." : "Schválit"}
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStatusChange(doc.id, "rejected")}
                          disabled={isUpdating || doc.status === "rejected"}
                        >
                          {isUpdating ? "Ukládám..." : "Zamítnout"}
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(doc.id, "draft")}
                          disabled={isUpdating || doc.status === "draft"}
                        >
                          {isUpdating ? "Ukládám..." : "Nastavit jako koncept"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
