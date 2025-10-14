export interface DuplicateRecord {
  date: string;
  wasteAmount: string;
  sheetName: string;
}

export interface ProcessingResult {
  success: boolean;
  foundationDocument: {
    id: string;
    title: string;
    status: string;
    basedOn: {
      id: string;
      title: string;
    };
  };
  processing: {
    sheetsModified: string[];
    extractedDataCount: number;
    recordsAdded: number;
    duplicatesSkipped: DuplicateRecord[];
    confidence: number;
    sourceDocumentId?: string;
    responseId?: string;
  };
}

export interface FoundationDocumentProcessorProps {
  documentId?: string;
  jobId?: string;
  autoTrigger?: boolean;
}
