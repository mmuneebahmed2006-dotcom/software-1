export type DocType = "invoice" | "quotation" | "dc" | "tax";
export type PaperSizeKey = "A4" | "A5" | "Letter" | "Legal";

export interface LineItem { id: string; description: string; unit: string; qty: number; rate: number }
export interface DocState {
  currency: string;
  client: { name: string; phone: string; email: string; address: string; website: string };
  meta: { number: string; date: string; dueDate: string; validUntil: string; poNumber: string; ntn: string; strn: string };
  dispatch: { method: string; vehicleNo: string; gatePassNo: string };
  items: LineItem[];
  taxRate: number;
  terms: string;
  paymentInfo: string;
  footer: { address: string; phone: string; email: string };
  minimumPages: number;
}
export interface SavedDocument {
  id: string; title: string; docType: DocType; paperSize: PaperSizeKey; state: DocState;
  folder: string; createdAt: number; updatedAt: number; storagePath?: string;
}
export interface CompanyDetails { address: string; phone: string; email: string; website: string; paymentInfo: string }
export type CompanyScope = "current" | "future" | "previous" | "all";

export const DOC_LABELS: Record<DocType, string> = { invoice: "Invoice", quotation: "Quotation", dc: "Delivery Challan", tax: "Sales Tax Invoice" };
export const CATEGORY_FOLDERS: Record<DocType, string> = { invoice: "Invoice", quotation: "Quotation", dc: "Delivery Challan", tax: "Sales Tax Invoice" };
export const CURRENCIES = ["Rs. ", "$", "€", "£", "AED "] as const;
export const PAPER_SIZES: Record<PaperSizeKey, { width: string; height: string; page: string; scale: number; rows: number; pdf: [number, number] }> = {
  A4: { width: "210mm", height: "297mm", page: "A4", scale: 1, rows: 10, pdf: [210, 297] },
  A5: { width: "148mm", height: "210mm", page: "A5", scale: .73, rows: 7, pdf: [148, 210] },
  Letter: { width: "8.5in", height: "11in", page: "letter", scale: .96, rows: 9, pdf: [215.9, 279.4] },
  Legal: { width: "8.5in", height: "14in", page: "legal", scale: 1, rows: 14, pdf: [215.9, 355.6] },
};

export function uid() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
export function createBlankDocumentState(): DocState {
  return { currency: "Rs. ", client: { name: "", phone: "", email: "", address: "", website: "" }, meta: { number: "", date: "", dueDate: "", validUntil: "", poNumber: "", ntn: "", strn: "" }, dispatch: { method: "", vehicleNo: "", gatePassNo: "" }, items: [{ id: uid(), description: "", unit: "pcs", qty: 1, rate: 0 }], taxRate: 0, terms: "", paymentInfo: "", footer: { address: "", phone: "", email: "" }, minimumPages: 1 };
}
export function createDocumentState() { return createBlankDocumentState() }
export function normalizeDocumentState(value: Partial<DocState> & { bank?: { name?: string; account?: string; paypal?: string } }): DocState {
  const blank = createBlankDocumentState();
  const legacyPayment = value.bank ? `Bank: ${value.bank.name ?? ""} • ${value.bank.account ?? ""} • PayPal: ${value.bank.paypal ?? ""}` : "";
  return { ...blank, ...value, client: { ...blank.client, ...value.client }, meta: { ...blank.meta, ...value.meta }, dispatch: { ...blank.dispatch, ...value.dispatch }, footer: { ...blank.footer, ...value.footer }, items: value.items?.length ? value.items : blank.items, paymentInfo: value.paymentInfo ?? legacyPayment, minimumPages: Math.min(99, Math.max(1, value.minimumPages ?? 1)) };
}
export function normalizeSavedDocument(value: Partial<SavedDocument> & Pick<SavedDocument, "id" | "title" | "docType" | "paperSize" | "state" | "updatedAt">): SavedDocument {
  return { ...value, id: value.id, title: value.title, docType: value.docType, paperSize: value.paperSize, state: normalizeDocumentState(value.state), folder: value.folder ?? "General", createdAt: value.createdAt ?? value.updatedAt, updatedAt: value.updatedAt, storagePath: value.storagePath };
}
export function documentTotal(state: DocState, docType: DocType) { if (docType === "dc") return 0; const subtotal = state.items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0); return subtotal * (1 + (state.taxRate || 0) / 100) }
export function money(amount: number, currency: string) { return `${currency}${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
export function safeFileName(docType: DocType, number: string) { const clean = number.replace(/^#/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "Untitled"; return `${DOC_LABELS[docType].replaceAll(" ", "_")}_${clean}` }
export function groupLabel(timestamp: number) { const days = Math.floor((Date.now() - timestamp) / 86400000); if (days <= 0) return "Today"; if (days <= 7) return "Last Week"; if (days <= 31) return "Last Month"; const months = Math.max(2, Math.round(days / 30)); return `${months} Months Ago` }
export function dateRangeStart(months: number) { const date = new Date(); date.setMonth(date.getMonth() - months); return date.getTime() }
export function matchesDateRange(document: SavedDocument, from?: number, to?: number) { return (!from || document.updatedAt >= from) && (!to || document.updatedAt <= to) }
export function companyFromState(state: DocState): CompanyDetails { return { ...state.footer, website: state.client.website, paymentInfo: state.paymentInfo } }
export function applyCompanyDetails(state: DocState, details: CompanyDetails): DocState { return { ...state, footer: { address: details.address, phone: details.phone, email: details.email }, client: { ...state.client, website: details.website }, paymentInfo: details.paymentInfo } }