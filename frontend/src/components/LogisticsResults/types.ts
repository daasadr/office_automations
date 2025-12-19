export interface LogisticsResultsProps {
  documentId?: string;
}

export interface AssociatedDocument {
  document_type?: string;
  document_number?: string;
  source_page_index?: number;
  recipient_name?: string;
  destination_address?: string;
  reference_numbers?: {
    order_number?: string;
    delivery_number?: string;
  };
  contains_handwriting?: boolean;
}

export interface TransportLineItem {
  line_id?: number;
  description?: string;
  invoice_amount?: number;
  vat_rate?: string;
  match_status?: "Matched" | "Unmatched";
  match_reason?: string;
  associated_documents?: AssociatedDocument[];
}

export interface UnclaimedDocument {
  source_page_index?: number;
  document_type?: string;
  content_summary?: string;
  reason_for_unclaimed?: string;
}

export interface InvoiceHeader {
  invoice_number?: string;
  dates?: {
    issue_date?: string;
    tax_date?: string;
    due_date?: string;
  };
  supplier?: {
    name?: string;
    vat_id?: string;
  };
  customer?: {
    name?: string;
    vat_id?: string;
  };
  totals?: {
    net_amount?: number;
    vat_amount?: number;
    total_amount_due?: number;
    currency?: string;
  };
}

export interface LogisticsDocumentData {
  id?: string;
  title?: string;
  processing_status?: string;
  invoice_header?: InvoiceHeader;
  transport_line_items?: TransportLineItem[];
  unclaimed_documents?: UnclaimedDocument[];
  confidence?: number;
  was_chunked?: boolean;
  chunk_count?: number;
  processing_time_ms?: number;
}
