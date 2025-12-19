import { FileText, Building2, Calendar, Banknote } from "lucide-react";
import type { InvoiceHeader } from "../types";

interface InvoiceHeaderCardProps {
  header?: InvoiceHeader;
}

export function InvoiceHeaderCard({ header }: InvoiceHeaderCardProps) {
  if (!header) {
    return (
      <div className="bg-card border rounded-lg p-6 text-center text-muted-foreground">
        Informace o faktuře nejsou k dispozici
      </div>
    );
  }

  const formatCurrency = (amount?: number, currency?: string) => {
    if (amount === undefined) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: currency || "CZK",
    }).format(amount);
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
        <div className="flex items-center gap-3 text-white">
          <FileText className="w-6 h-6" />
          <div>
            <h3 className="text-lg font-semibold">Faktura č. {header.invoice_number || "N/A"}</h3>
            {header.dates?.issue_date && (
              <p className="text-orange-100 text-sm">Datum vystavení: {header.dates.issue_date}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 grid md:grid-cols-3 gap-6">
        {/* Supplier */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Building2 className="w-4 h-4" />
            Dodavatel
          </div>
          <div>
            <p className="font-medium">{header.supplier?.name || "-"}</p>
            {header.supplier?.vat_id && (
              <p className="text-sm text-muted-foreground">IČ DPH: {header.supplier.vat_id}</p>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Building2 className="w-4 h-4" />
            Odběratel
          </div>
          <div>
            <p className="font-medium">{header.customer?.name || "-"}</p>
            {header.customer?.vat_id && (
              <p className="text-sm text-muted-foreground">IČ DPH: {header.customer.vat_id}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Calendar className="w-4 h-4" />
            Důležité termíny
          </div>
          <div className="text-sm space-y-1">
            {header.dates?.tax_date && <p>Datum zdanitelného plnění: {header.dates.tax_date}</p>}
            {header.dates?.due_date && <p>Datum splatnosti: {header.dates.due_date}</p>}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="border-t bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-3">
          <Banknote className="w-4 h-4" />
          Částky
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Základ daně</p>
            <p className="text-lg font-semibold">
              {formatCurrency(header.totals?.net_amount, header.totals?.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DPH</p>
            <p className="text-lg font-semibold">
              {formatCurrency(header.totals?.vat_amount, header.totals?.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Celkem k úhradě</p>
            <p className="text-xl font-bold text-orange-600">
              {formatCurrency(header.totals?.total_amount_due, header.totals?.currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
