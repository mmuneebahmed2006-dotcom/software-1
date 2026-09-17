import { useMemo, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer } from "lucide-react";
import { DocumentPaper } from "@/components/document-paper";
import { Button } from "@/components/ui/button";
import { CURRENCIES, DOC_LABELS, PAPER_SIZES, uid, type DocState, type DocType, type PaperSizeKey } from "@/lib/document";

const DOC_ORDER: DocType[] = ["invoice", "quotation", "dc", "tax"];
const PAPER_ORDER: PaperSizeKey[] = ["A4", "A5", "Letter", "Legal"];

function createInitialState(): DocState {
  return {
    currency: "Rs. ",
    client: { name: "Mrs Angela Fransisca", phone: "+1 223-963-9621", email: "yourname@gmail.com", address: "123 2nd Ave #110, NYC", website: "www.yourname.com" },
    meta: { number: "#351-34", date: "05/05/2026", dueDate: "06/07/2026", validUntil: "06/07/2026", poNumber: "", ntn: "", strn: "" },
    dispatch: { method: "", vehicleNo: "", gatePassNo: "" },
    items: [
      { id: uid(), description: "Logo Design", unit: "pcs", qty: 1, rate: 120 },
      { id: uid(), description: "Flyer Design", unit: "pcs", qty: 2, rate: 20 },
      { id: uid(), description: "Web Development", unit: "pcs", qty: 1, rate: 90 },
      { id: uid(), description: "Revision Logo", unit: "hrs", qty: 3, rate: 10 },
      { id: uid(), description: "Poster Design", unit: "pcs", qty: 5, rate: 25 },
    ],
    taxRate: 18,
    terms: "Payment is due within 20 days.",
    bank: { name: "Bank name", account: "Account / IBAN", paypal: "info@paypaladdress.com" },
    footer: { address: "55 Ambu Abah Street, East Sedok Java", phone: "P. 000 000 000 000", email: "info@yourdomain.com" },
  };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Document Studio | 8 Ways Communications" },
      { name: "description", content: "Create print-ready invoices, quotations, delivery challans, and sales tax invoices." },
      { property: "og:title", content: "Document Studio | 8 Ways Communications" },
      { property: "og:description", content: "Create professional, print-ready business documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [docType, setDocType] = useState<DocType>("invoice");
  const [paperSize, setPaperSize] = useState<PaperSizeKey>("A4");
  const [state, setState] = useState<DocState>(createInitialState);
  const paper = PAPER_SIZES[paperSize];
  const paperStyle = useMemo(() => ({ "--paper-width": paper.width, "--paper-height": paper.height } as CSSProperties), [paper]);

  return (
    <div className="studio-shell">
      <style>{`@media print { @page { size: ${paper.page}; margin: 0; } }`}</style>
      <header className="no-print toolbar">
        <div className="toolbar-inner">
          <div className="studio-brand"><FileText size={19} /><span>Document Studio</span></div>
          <div className="document-tabs" role="group" aria-label="Document type">
            {DOC_ORDER.map((type) => <Button key={type} type="button" variant="ghost" aria-pressed={docType === type} className={docType === type ? "active" : ""} onClick={() => setDocType(type)}>{DOC_LABELS[type]}</Button>)}
          </div>
          <div className="toolbar-actions">
            <label className="select-control"><span>Currency</span><select value={state.currency} onChange={(event) => setState((current) => ({ ...current, currency: event.target.value }))} aria-label="Currency">{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency.trim()}</option>)}</select></label>
            <label className="select-control"><span>Paper</span><select value={paperSize} onChange={(event) => setPaperSize(event.target.value as PaperSizeKey)} aria-label="Paper size">{PAPER_ORDER.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <Button type="button" onClick={() => window.print()}><Printer size={16} /> Save as PDF</Button>
          </div>
        </div>
      </header>
      <main className="print-area"><DocumentPaper docType={docType} state={state} setState={setState} paperStyle={paperStyle} /></main>
    </div>
  );
}
