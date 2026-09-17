export type DocType = "invoice" | "quotation" | "dc" | "tax";
export type PaperSizeKey = "A4" | "A5" | "Letter" | "Legal";

export interface LineItem {
  id: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
}

export interface DocState {
  currency: string;
  client: { name: string; phone: string; email: string; address: string; website: string };
  meta: {
    number: string;
    date: string;
    dueDate: string;
    validUntil: string;
    poNumber: string;
    ntn: string;
    strn: string;
  };
  dispatch: { method: string; vehicleNo: string; gatePassNo: string };
  items: LineItem[];
  taxRate: number;
  terms: string;
  bank: { name: string; account: string; paypal: string };
  footer: { address: string; phone: string; email: string };
}

export const DOC_LABELS: Record<DocType, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  dc: "Delivery Challan",
  tax: "Sales Tax Invoice",
};

export const CURRENCIES = ["Rs. ", "$", "€", "£", "AED "] as const;

export const PAPER_SIZES: Record<PaperSizeKey, { width: string; height: string; page: string }> = {
  A4: { width: "210mm", height: "297mm", page: "A4" },
  A5: { width: "148mm", height: "210mm", page: "A5" },
  Letter: { width: "8.5in", height: "11in", page: "letter" },
  Legal: { width: "8.5in", height: "14in", page: "legal" },
};

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function money(amount: number, currency: string) {
  const value = (Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${value}`;
}