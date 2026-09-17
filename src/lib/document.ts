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
  paymentInfo: string;
  footer: { address: string; phone: string; email: string };
}

export interface SavedDocument {
  id: string;
  title: string;
  docType: DocType;
  paperSize: PaperSizeKey;
  state: DocState;
  updatedAt: number;
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
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDocumentState(): DocState {
  return {
    currency: "Rs. ",
    client: { name: "Mrs Angela Fransisca", phone: "+1 223-963-9621", email: "yourname@gmail.com", address: "123 2nd Ave #110, NYC", website: "www.yourname.com" },
    meta: { number: "#351-34", date: "05/05/2026", dueDate: "06/07/2026", validUntil: "06/07/2026", poNumber: "", ntn: "", strn: "" },
    dispatch: { method: "", vehicleNo: "", gatePassNo: "" },
    items: [
      { id: "line-logo", description: "Logo Design", unit: "pcs", qty: 1, rate: 120 },
      { id: "line-flyer", description: "Flyer Design", unit: "pcs", qty: 2, rate: 20 },
      { id: "line-web", description: "Web Development", unit: "pcs", qty: 1, rate: 90 },
      { id: "line-revision", description: "Revision Logo", unit: "hrs", qty: 3, rate: 10 },
      { id: "line-poster", description: "Poster Design", unit: "pcs", qty: 5, rate: 25 },
    ],
    taxRate: 18,
    terms: "Payment is due within 20 days.",
    paymentInfo: "Bank: Bank name  •  Account / IBAN  •  PayPal: info@paypaladdress.com",
    footer: { address: "55 Ambu Abah Street, East Sedok Java", phone: "P. 000 000 000 000", email: "info@yourdomain.com" },
  };
}

export function normalizeDocumentState(value: Partial<DocState> & { bank?: { name?: string; account?: string; paypal?: string } }): DocState {
  const fallback = createDocumentState();
  const legacyPayment = value.bank ? `Bank: ${value.bank.name ?? ""}  •  ${value.bank.account ?? ""}  •  PayPal: ${value.bank.paypal ?? ""}` : fallback.paymentInfo;
  return {
    ...fallback,
    ...value,
    client: { ...fallback.client, ...value.client },
    meta: { ...fallback.meta, ...value.meta },
    dispatch: { ...fallback.dispatch, ...value.dispatch },
    footer: { ...fallback.footer, ...value.footer },
    items: value.items?.length ? value.items : fallback.items,
    paymentInfo: value.paymentInfo ?? legacyPayment,
  };
}

export function money(amount: number, currency: string) {
  const value = (Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${value}`;
}