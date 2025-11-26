import { useState, useRef } from "react";
import { useLogger } from "@/lib/client-logger";
import { withBasePath } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

/**
 * Sanitizes filename by removing or replacing special characters
 * Handles Czech diacritics and other potentially problematic characters
 */
function sanitizeFilename(filename: string): string {
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

  const lastDotIndex = filename.lastIndexOf(".");
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : "";

  let sanitized = name
    .split("")
    .map((char) => diacriticsMap[char] || char)
    .join("");

  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, "_");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^_+|_+$/g, "");

  if (!sanitized) {
    sanitized = "document";
  }

  return sanitized + extension;
}

export default function UploadDocument() {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const log = useLogger("UploadDocument");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const sanitizedFilename = sanitizeFilename(file.name);
    const sanitizedTitle = sanitizedFilename.replace(/\.[^/.]+$/, "");

    log.info("Uploading foundation document", {
      originalFilename: file.name,
      sanitizedFilename,
    });
    setUploadingFile(true);
    setError(null);
    setSuccess(false);

    try {
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

      setSuccess(true);

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

  return (
    <div className="space-y-6">
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

      {error && (
        <Alert variant="destructive">
          <p className="font-medium">Chyba</p>
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {success && (
        <Alert>
          <p className="font-medium">Úspěch</p>
          <p className="text-sm">Dokument byl úspěšně nahrán a schválen.</p>
        </Alert>
      )}
    </div>
  );
}
