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
   - Handwriting Detection: specific check if the document contains handwritten text (common in ALONŽ/CMR forms) and flag it.

3. Perform Matching (The Core Task):
   - For each Invoice Line Item found in Step 1, search the Supporting Documents from Step 2.
   - Matching Criteria: Match documents based on Destination/Location (e.g., if the invoice says "Zlín - Partizánske", look for documents addressed to Partizánske) and Dates (proximity to the invoice service date).
   - Association: Nest the details of the found documents under the corresponding Invoice Line Item.

4. Handling Exceptions:
   - If no document matches an invoice line item, you must set match_status to "Unmatched" and provide a reason (e.g., "No document found with destination 'Chemnitz'").
   - If a document exists but cannot be confidently linked to a specific line item, list it in a separate unclaimed_documents array at the end of the JSON.

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
      "match_reason": "String (e.g., 'Matched based on destination Partizánske found in Delivery Note 52640')",
      "associated_documents": [
        {
          "document_type": "String (e.g., 'Delivery Note', 'CMR', 'Transport Log')",
          "document_number": "String (e.g., Delivery Note No., or 'N/A')",
          "source_page_index": "Integer (Page number in PDF)",
          "recipient_name": "String",
          "destination_address": "String",
          "reference_numbers": {
            "order_number": "String",
            "delivery_number": "String"
          },
          "contains_handwriting": "Boolean (true if handwritten text/signatures are detected)"
        }
      ]
    }
  ],
  "unclaimed_documents": [
    {
      "source_page_index": "Integer",
      "document_type": "String",
      "content_summary": "String",
      "reason_for_unclaimed": "String (e.g., 'Destination Prague not found in invoice list')"
    }
  ],
  "present_fields": ["List of field types that were found in the document"],
  "missing_fields": ["List of field types that could not be found"],
  "confidence": 85.5
}

Constraint Checklist & Confidence Score:
- Is the output valid JSON?
- Did you flag handwritten documents?
- Did you explain the match/no-match reason for every line item?

IMPORTANT:
- Output ONLY valid JSON, no markdown formatting or explanatory text
- All keys must use snake_case
- Numbers should be actual numbers, not strings (except where specified)
- Dates should be in DD.MM.YYYY format
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
