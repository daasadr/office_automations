export interface IndependentEstablishment {
  establishment_number?: string | null;
  name?: string | null;
  address?: string | null;
  responsible_person?: string | null;
}

export interface WasteOriginator {
  company_id?: string;
  name?: string;
  address?: string;
  responsible_person?: string | null;
  independent_establishment?: IndependentEstablishment | null;
}

export interface WasteRecipient {
  company_id?: string;
  name?: string;
  address?: string;
  independent_establishment?: IndependentEstablishment | null;
}

export interface WasteRecord {
  serial_number?: number;
  date?: string;
  waste_amount_generated?: number | null;
  waste_amount_transferred?: number | null;
}

export interface ExtractedDataRecord {
  waste_code?: string;
  waste_name?: string;
  waste_category?: string | null;
  handling_code?: string | null;
  originator?: WasteOriginator;
  recipient?: WasteRecipient;
  records?: WasteRecord[];
}

export interface ValidationData {
  validationResult: {
    present_fields: string[];
    missing_fields: string[];
    confidence: number;
    extracted_data?: ExtractedDataRecord[];
  };
  directusSourceDocumentId?: string;
  status?: string;
}

export interface ValidationStatusPollerProps {
  documentId?: string;
  jobId?: string;
}
