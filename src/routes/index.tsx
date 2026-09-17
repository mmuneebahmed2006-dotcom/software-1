import { useMemo, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Printer, Save } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { DocumentPaper } from "@/components/document-paper";
import { SavedDocumentsSidebar } from "@/components/saved-documents-sidebar";
import { Button } from "@/components/ui/button";
import { useSavedDocuments } from "@/hooks/use-saved-documents";
import { CURRENCIES, DOC_LABELS, PAPER_SIZES, createDocumentState, uid, type DocState, type DocType, type PaperSizeKey, type SavedDocument } from "@/lib/document";

const DOC_ORDER: DocType[] = ["invoice", "quotation", "dc", "tax"];
const PAPER_ORDER: PaperSizeKey[] = ["A4", "A5", "Letter", "Legal"];

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
  const [state, setState] = useState<DocState>(createDocumentState);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { documents, setDocuments } = useSavedDocuments();
  const paper = PAPER_SIZES[paperSize];
  const paperStyle = useMemo(() => ({ "--paper-width": paper.width, "--paper-height": paper.height } as CSSProperties), [paper]);

  const newDocument = () => {
    setActiveId(null);
    setDocType("invoice");
    setPaperSize("A4");
    setState(createDocumentState());
  };
  const openDocument = (document: SavedDocument) => {
    setActiveId(document.id);
    setDocType(document.docType);
    setPaperSize(document.paperSize);
    setState(document.state);
  };
  const saveDocument = () => {
    const now = Date.now();
    if (activeId) {
      setDocuments((current) => current.map((document) => document.id === activeId ? { ...document, docType, paperSize, state, updatedAt: now } : document));
      return;
    }
    const id = uid();
    const title = `${DOC_LABELS[docType]} ${state.meta.number || documents.length + 1}`;
    setDocuments((current) => [{ id, title, docType, paperSize, state, updatedAt: now }, ...current]);
    setActiveId(id);
  };
  const printDocument = (blackAndWhite: boolean) => {
    document.documentElement.classList.toggle("print-bw", blackAndWhite);
    const cleanup = () => document.documentElement.classList.remove("print-bw");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };
  const downloadPdf = async () => {
    const element = document.getElementById("document-paper");
    if (!element) return;
    setExporting(true);
    element.classList.add("exporting");
    try {
      const dataUrl = await toPng(element, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
      const format = paperSize === "Letter" ? "letter" : paperSize === "Legal" ? "legal" : paperSize.toLowerCase();
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format });
      pdf.addImage(dataUrl, "PNG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, "FAST");
      pdf.save(`${(state.meta.number || DOC_LABELS[docType]).replace(/[^a-z0-9-_]+/gi, "-")}.pdf`);
    } finally {
      element.classList.remove("exporting");
      setExporting(false);
    }
  };

  return (
    <div className="studio-shell">
      <style>{`@media print { @page { size: ${paper.page}; margin: 0; } }`}</style>
      <SavedDocumentsSidebar
        documents={documents}
        activeId={activeId}
        onNew={newDocument}
        onOpen={openDocument}
        onRename={(id, title) => setDocuments((current) => current.map((document) => document.id === id ? { ...document, title } : document))}
        onDelete={(id) => {
          if (!window.confirm("Delete this saved document?")) return;
          setDocuments((current) => current.filter((document) => document.id !== id));
          if (activeId === id) newDocument();
        }}
      />
      <div className="studio-main">
      <header className="no-print toolbar">
        <div className="toolbar-inner">
          <div className="studio-brand"><FileText size={19} /><span>Document Studio</span></div>
          <div className="document-tabs" role="group" aria-label="Document type">
            {DOC_ORDER.map((type) => <Button key={type} type="button" variant="ghost" aria-pressed={docType === type} className={docType === type ? "active" : ""} onClick={() => setDocType(type)}>{DOC_LABELS[type]}</Button>)}
          </div>
          <div className="toolbar-actions">
            <label className="select-control"><span>Currency</span><select value={state.currency} onChange={(event) => setState((current) => ({ ...current, currency: event.target.value }))} aria-label="Currency">{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency.trim()}</option>)}</select></label>
            <label className="select-control"><span>Paper</span><select value={paperSize} onChange={(event) => setPaperSize(event.target.value as PaperSizeKey)} aria-label="Paper size">{PAPER_ORDER.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <Button type="button" variant="secondary" onClick={saveDocument}><Save size={16} /> Save Document</Button>
            <Button type="button" variant="secondary" onClick={downloadPdf} disabled={exporting}><Download size={16} /> {exporting ? "Exporting…" : "Download PDF"}</Button>
            <Button type="button" onClick={() => printDocument(false)}><Printer size={16} /> Print (Color)</Button>
            <Button type="button" onClick={() => printDocument(true)}><Printer size={16} /> Print (B&amp;W)</Button>
          </div>
        </div>
      </header>
      <main className="print-area"><DocumentPaper docType={docType} state={state} setState={setState} paperStyle={paperStyle} /></main>
      </div>
    </div>
  );
}
