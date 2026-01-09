export interface LogisticsStatusPollerProps {
  jobId?: string;
}

export interface LogisticsResult {
  invoice_header?: {
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
  };
  transport_line_items?: Array<{
    line_id?: number;
    description?: string;
    invoice_amount?: number;
    vat_rate?: string;
    match_status?: "Matched" | "Unmatched";
    match_reason?: string;
    associated_documents?: Array<{
      document_type?: string;
      document_number?: string;
      source_page_index?: number;
      recipient_name?: string;
      destination_address?: string;
      reference_numbers?: {
        order_number?: string;
        delivery_number?: string;
      };
      is_handwritten?: boolean;
    }>;
  }>;
  unclaimed_documents?: Array<{
    source_page_index?: number;
    document_type?: string;
    content_summary?: string;
    reason_for_unclaimed?: string;
  }>;
  confidence?: number;
  present_fields?: string[];
  missing_fields?: string[];
}

export interface LogisticsStatusData {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  logisticsDocumentId?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  wasChunked?: boolean;
  chunkCount?: number;
  result?: LogisticsResult;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}
