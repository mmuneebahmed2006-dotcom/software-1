import { useMemo, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer, Save } from "lucide-react";
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
  const printDocument = () => {
    window.print();
  };

  return (
    <div className="studio-shell">
      <style>{`@media print { @page { size: ${paper.page} portrait; margin: 0; } }`}</style>
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
            <Button type="button" onClick={printDocument}><Printer size={16} /> Print</Button>
          </div>
        </div>
      </header>
      <main className="print-area"><DocumentPaper docType={docType} state={state} setState={setState} paperStyle={paperStyle} /></main>
      </div>
    </div>
  );
}
