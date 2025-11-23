export interface ExtractedData {
  waste_code?: string;
  waste_name?: string;
  waste_category?: string;
  handling_code?: string;
  originator?: {
    company_id?: string;
    name?: string;
    address?: string;
    responsible_person?: string;
    independent_establishment?: {
      establishment_number?: string;
      name?: string;
      address?: string;
      responsible_person?: string;
    };
  };
  recipient?: {
    company_id?: string;
    name?: string;
    address?: string;
    independent_establishment?: {
      establishment_number?: string;
      name?: string;
      address?: string;
      responsible_person?: string;
    };
  };
  records?: Array<{
    serial_number?: string | number;
    date?: string;
    waste_amount_generated?: string | number;
    waste_amount_transferred?: string | number;
  }>;
}
