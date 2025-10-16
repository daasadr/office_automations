export interface DuplicateRecord {
  date: string;
  wasteAmount: string;
  sheetName: string;
}

export interface SheetNotFound {
  kodOdpadu: string;
  nazevOdpadu: string;
  odberatelIco: string;
  odberatelNazev: string;
  puvodceIco: string;
  puvodceNazev: string;
  targetSheetName: string;
}

export interface ExtractedRecord {
  poradoveCislo: number;
  datumVzniku: string;
  mnozstviVznikleho: string;
  mnozstviPredaneho: string;
  isDuplicate?: boolean;
}

export interface ExtractedRecordDetail {
  sheetName: string;
  kodOdpadu: string;
  nazevOdpadu: string;
  odberatel: {
    ico: string;
    nazev: string;
  };
  records: ExtractedRecord[];
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
    sheetsNotFound?: SheetNotFound[];
    confidence: number;
    sourceDocumentId?: string;
    responseId?: string;
    extractedRecordsDetail?: ExtractedRecordDetail[];
  };
}

export interface FoundationDocumentProcessorProps {
  documentId?: string;
  jobId?: string;
  autoTrigger?: boolean;
}
