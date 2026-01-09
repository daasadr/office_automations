import type { PromptConfig, PromptBuilder } from "./types";

/**
 * Required fields for logistics invoice/transport document validation
 */
export const LOGISTICS_REQUIRED_FIELDS = [
  "Invoice Header (Number, Dates, Supplier, Customer, Totals)",
  "Transport Line Items from Invoice",
  "Supporting Documents (Delivery Notes, CMR, Transport Logs)",
  "Document-to-Invoice Matching",
  "Handwriting Detection on Documents",
  "Unclaimed/Unmatched Documents Identification",
] as const;

/**
 * Logistics document analysis prompt configuration
 * Handles master invoices with supporting transport documents
 */
const logisticsPromptConfig: PromptConfig = {
  id: "logistics",
  name: "Logistics Invoice & Transport Document Analysis",
  description:
    "Analyzes master invoices with supporting transport documents (Delivery Notes, CMRs, Transport Logs) and performs matching",
  requiredFields: LOGISTICS_REQUIRED_FIELDS,
  template: `You are a specialized Data Extraction and Logistics Auditing AI. Your task is to process the provided PDF file, which contains a master invoice followed by a series of supporting transport documents (Delivery Notes, CMRs, Transport Logs, etc.).

You must output your analysis exclusively as a valid, parsable JSON object. Do not include markdown formatting (like \`\`\`json) or conversational text outside the JSON structure.

Processing Logic

1. Analyze the Main Invoice (Pages 1-2):
   - Extract the Invoice Header details (Invoice Number, Dates, Supplier, Customer, Total Amounts).
   - Extract every single line item listed in the "Fakturujeme Vám" (We invoice you) table. Each line item represents a specific transport service (e.g., "Zlín - Partizánske").

2. Analyze Supporting Documents (Pages 3-End):
   - Scan each subsequent page to identify individual documents (Dodací list/Delivery Note, CMR, ALONŽ/Transport Log, Weighing Slips).
   - Extract key data points from these documents: Recipient Name, Delivery Destination, Order Numbers (Objednávka), Delivery Note Numbers (Č. dodávky), and Dates.
   - Order Number Extraction (CRITICAL): Pay special attention to "Dodací list" (Delivery Note) documents from Spur supplier ("Dodavatel"). The "order_number_ours" field typically appears on these delivery notes and usually begins with the letters S, H, or T. This is a critical field that must be extracted accurately.
   - Order Number Category: Based on the first letter of "order_number_ours", set "order_number_category" as follows:
     * S → "EPE pásy"
     * H → "Hardex"
     * T → "Tubex"
     * If the order number doesn't start with S, H, or T, set category to "Unknown" or leave empty.
   - Handwriting Detection: Determine if the document is PRIMARILY handwritten (e.g., forms like ALONŽ/CMR with handwritten fields filled in). Set "is_handwritten" to true ONLY for documents that are primarily handwritten forms, NOT for printed invoices or delivery notes that merely contain some handwritten annotations or signatures. The document should have a significant portion of its key data fields filled in by hand.

3. Perform Matching (The Core Task):
   - For each Invoice Line Item found in Step 1, search the Supporting Documents from Step 2.
   - Matching Criteria: Match documents based on Destination/Location (e.g., if the invoice says "Zlín - Partizánske", look for documents addressed to Partizánske) and Dates (proximity to the invoice service date).
   - Association: Nest the details of the found documents under the corresponding Invoice Line Item.

4. Handling Exceptions:
   - If no document matches an invoice line item, you must set match_status to "Unmatched" and provide a reason IN CZECH (e.g., "Nebyl nalezen dokument s destinací 'Chemnitz'").
   - If a document exists but cannot be confidently linked to a specific line item, list it in a separate unclaimed_documents array at the end of the JSON with reason_for_unclaimed IN CZECH.

JSON Output Structure

Use the following JSON schema strictly:

{
  "invoice_header": {
    "invoice_number": "String (e.g., 2025808)",
    "dates": {
      "issue_date": "String",
      "tax_date": "String",
      "due_date": "String"
    },
    "supplier": {
      "name": "String",
      "vat_id": "String"
    },
    "customer": {
      "name": "String",
      "vat_id": "String"
    },
    "totals": {
      "net_amount": "Number",
      "vat_amount": "Number",
      "total_amount_due": "Number",
      "currency": "String"
    }
  },
  "transport_line_items": [
    {
      "line_id": "Integer (1, 2, 3...)",
      "description": "String (Exact text from invoice, e.g., 'Zlín - Partizánske')",
      "invoice_amount": "Number",
      "vat_rate": "String",
      "match_status": "String ('Matched' or 'Unmatched')",
      "match_reason": "String in CZECH (e.g., 'Spárováno na základě destinace Partizánske nalezené v Dodacím listu 52640')",
      "associated_documents": [
        {
          "document_type": "String in CZECH (e.g., 'Dodací list', 'CMR', 'Přepravní deník', 'ALONŽ')",
          "document_number": "String (e.g., Delivery Note No., or 'N/A')",
          "source_page_index": "Integer (Page number in PDF)",
          "recipient_name": "String",
          "destination_address": "String",
          "reference_numbers": {
            "order_number_customer": "String",
            "order_number_ours": "String (CRITICAL: Usually found on 'Dodací list' from Spur supplier, typically starts with S, H, or T)",
            "order_number_category": "String (Derived from first letter of order_number_ours: 'EPE pásy' for S, 'Hardex' for H, 'Tubex' for T, or 'Unknown' if none match)",
            "delivery_number": "String"
          },
          "is_handwritten": "Boolean (true ONLY if the document is primarily a handwritten form with handwritten fields, NOT for printed documents with occasional handwritten annotations)"
        }
      ]
    }
  ],
  "unclaimed_documents": [
    {
      "source_page_index": "Integer",
      "document_type": "String",
      "content_summary": "String",
      "reason_for_unclaimed": "String in CZECH (e.g., 'Destinace Praha nebyla nalezena v seznamu faktury')"
    }
  ],
  "present_fields": ["List of field types that were found in the document"],
  "missing_fields": ["List of field types that could not be found"],
  "confidence": 85.5
}

Constraint Checklist & Confidence Score:
- Is the output valid JSON?
- Did you correctly identify primarily handwritten documents (forms with handwritten fields) vs printed documents with annotations?
- Did you explain the match/no-match reason for every line item?

IMPORTANT:
- Output ONLY valid JSON, no markdown formatting or explanatory text
- All keys must use snake_case
- Numbers should be actual numbers, not strings (except where specified)
- Dates should be in DD.MM.YYYY format
- ALL user-facing text fields (document_type, match_reason, reason_for_unclaimed) MUST be in CZECH language
- Include present_fields, missing_fields, and confidence in the response

Kontrolované typy informací:
{{REQUIRED_FIELDS}}

Generate the JSON response now.`,
};

/**
 * Logistics prompt builder
 */
export class LogisticsPromptBuilder implements PromptBuilder {
  private config: PromptConfig;

  constructor() {
    this.config = logisticsPromptConfig;
  }

  getConfig(): PromptConfig {
    return this.config;
  }

  getRequiredFields(): readonly string[] {
    return this.config.requiredFields;
  }

  buildPrompt(): string {
    const fieldsText = this.config.requiredFields
      .map((field, index) => `${index + 1}. ${field}`)
      .join("\n");

    return this.config.template.replace("{{REQUIRED_FIELDS}}", fieldsText);
  }
}

/**
 * Create a logistics prompt builder instance
 */
export function createLogisticsPromptBuilder(): LogisticsPromptBuilder {
  return new LogisticsPromptBuilder();
}
