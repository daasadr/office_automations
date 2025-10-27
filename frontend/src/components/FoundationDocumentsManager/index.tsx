import { useState, useEffect, useCallback, useRef } from "react";
import { useLogger } from "@/lib/client-logger";
import { withBasePath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

/**
 * Sanitizes filename by removing or replacing special characters
 * Handles Czech diacritics and other potentially problematic characters
 */
function sanitizeFilename(filename: string): string {
  // Map of diacritics to their ASCII equivalents
  const diacriticsMap: Record<string, string> = {
    á: "a",
    č: "c",
    ď: "d",
    é: "e",
    ě: "e",
    í: "i",
    ň: "n",
    ó: "o",
    ř: "r",
    š: "s",
    ť: "t",
    ú: "u",
    ů: "u",
    ý: "y",
    ž: "z",
    Á: "A",
    Č: "C",
    Ď: "D",
    É: "E",
    Ě: "E",
    Í: "I",
    Ň: "N",
    Ó: "O",
    Ř: "R",
    Š: "S",
    Ť: "T",
    Ú: "U",
    Ů: "U",
    Ý: "Y",
    Ž: "Z",
  };

  // Split filename into name and extension
  const lastDotIndex = filename.lastIndexOf(".");
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : "";

  // Replace diacritics
  let sanitized = name
    .split("")
    .map((char) => diacriticsMap[char] || char)
    .join("");

  // Remove or replace other special characters
  // Keep: letters, numbers, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Remove multiple consecutive underscores
  sanitized = sanitized.replace(/_+/g, "_");

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, "");

  // If name is empty after sanitization, use a default
  if (!sanitized) {
    sanitized = "document";
  }

  return sanitized + extension;
}

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

export default function FoundationDocumentsManager() {
  const [documents, setDocuments] = useState<FoundationDocument[]>([]);
  const [lastApprovedId, setLastApprovedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const log = useLogger("FoundationDocumentsManager");

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Sanitize filename to avoid issues with special characters
    const sanitizedFilename = sanitizeFilename(file.name);
    const sanitizedTitle = sanitizedFilename.replace(/\.[^/.]+$/, ""); // Remove extension

    log.info("Uploading foundation document", {
      originalFilename: file.name,
      sanitizedFilename,
    });
    setUploadingFile(true);
    setError(null);

    try {
      // Create a new File object with sanitized name
      const sanitizedFile = new File([file], sanitizedFilename, {
        type: file.type,
        lastModified: file.lastModified,
      });

      const formData = new FormData();
      formData.append("file", sanitizedFile);
      formData.append("title", sanitizedTitle);

      const response = await fetch(withBasePath("/api/upload-foundation"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload document");
      }

      const result = await response.json();
      log.info("Document uploaded successfully", { documentId: result.foundationDocument?.id });

      // Refresh the list
      await fetchDocuments();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Failed to upload document", err instanceof Error ? err : new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setUploadingFile(false);
    }
  };

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
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Nahrát nový zakládající dokument</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Nahrajte Excel soubor (.xlsx), který bude použit jako zakládající dokument. Nově
              nahrané dokumenty jsou automaticky schváleny.
            </p>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {uploadingFile && <span className="text-sm text-muted-foreground">Nahrávám...</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <p className="font-medium">Chyba</p>
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {/* Current Active Document */}
      {lastApprovedId && (
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
            {(() => {
              const activeDoc = documents.find((doc) => doc.id === lastApprovedId);
              if (!activeDoc) return null;

              return (
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
                          Tento dokument je aktuálně používán pro augmentaci nových dat ze
                          zpracovaných PDF souborů.
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
              );
            })()}
          </CardContent>
        </Card>
      )}

      {!lastApprovedId && (
        <Alert>
          <p className="font-medium">Žádný aktivní dokument</p>
          <p className="text-sm">
            Momentálně není nastaven žádný schválený dokument pro augmentaci. Nahrajte nový dokument
            nebo schvalte některý z existujících dokumentů.
          </p>
        </Alert>
      )}

      {/* Documents List */}
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

                        {/* Approve button - disabled if already approved */}
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleStatusChange(doc.id, "approved")}
                          disabled={isUpdating || doc.status === "approved"}
                        >
                          {isUpdating ? "Ukládám..." : "Schválit"}
                        </Button>

                        {/* Reject button - disabled if already rejected */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStatusChange(doc.id, "rejected")}
                          disabled={isUpdating || doc.status === "rejected"}
                        >
                          {isUpdating ? "Ukládám..." : "Zamítnout"}
                        </Button>

                        {/* Draft button - disabled if already draft */}
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
