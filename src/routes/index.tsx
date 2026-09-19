import { useMemo, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Printer, Save } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { DocumentPaper } from "@/components/document-paper";
import { SavedDocumentsSidebar } from "@/components/saved-documents-sidebar";
import { Button } from "@/components/ui/button";
import { useSavedDocuments } from "@/hooks/use-saved-documents";
import { CURRENCIES, DOC_LABELS, PAPER_SIZES, createBlankDocumentState, createDocumentState, uid, type DocState, type DocType, type PaperSizeKey, type SavedDocument } from "@/lib/document";

const DOC_ORDER: DocType[] = ["invoice", "quotation", "dc", "tax"];
const PAPER_ORDER: PaperSizeKey[] = ["A4", "A5", "Letter", "Legal"];
const PDF_SIZES: Record<PaperSizeKey, [number, number]> = {
  A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6],
};

type SavePickerWindow = Window & typeof globalThis & {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<{ createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }> }>;
};

function safeFileName(docType: DocType, number: string) {
  const cleanNumber = number.replace(/^#/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "Untitled";
  return `${DOC_LABELS[docType].replaceAll(" ", "_")}_${cleanNumber}`;
}

async function saveBlob(blob: Blob, suggestedName: string, description: string, extension: string) {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    const handle = await picker({ suggestedName, types: [{ description, accept: { [blob.type]: [extension] } }] });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const [state, setState] = useState<DocState>(createDocumentState);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { documents, setDocuments } = useSavedDocuments();
  const paper = PAPER_SIZES[paperSize];
  const paperStyle = useMemo(() => ({ "--paper-width": paper.width, "--paper-height": paper.height } as CSSProperties), [paper]);

  const newDocument = () => {
    setActiveId(null);
    setDocType("invoice");
    setPaperSize("A4");
    setState(createBlankDocumentState());
  };
  const openDocument = (document: SavedDocument) => {
    setActiveId(document.id);
    setDocType(document.docType);
    setPaperSize(document.paperSize);
    setState(document.state);
  };
  const saveDocument = async () => {
    const now = Date.now();
    let saved: SavedDocument;
    if (activeId) {
      const currentTitle = documents.find((document) => document.id === activeId)?.title;
      saved = { id: activeId, title: currentTitle || `${DOC_LABELS[docType]} ${state.meta.number || "Untitled"}`, docType, paperSize, state, updatedAt: now };
      setDocuments((current) => current.map((document) => document.id === activeId ? { ...document, docType, paperSize, state, updatedAt: now } : document));
    } else {
      const id = uid();
      const title = `${DOC_LABELS[docType]} ${state.meta.number || documents.length + 1}`;
      saved = { id, title, docType, paperSize, state, updatedAt: now };
      setDocuments((current) => [saved, ...current]);
      setActiveId(id);
    }
    try {
      const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
      await saveBlob(blob, `${safeFileName(docType, state.meta.number)}.document.json`, "Document data", ".json");
      toast.success("Document saved to the workspace and your selected folder.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") toast.success("Document saved to the workspace.");
      else toast.error("Document was saved to the workspace, but the file could not be written.");
    }
  };
  const downloadPdf = async () => {
    const element = document.getElementById("document-paper");
    if (!element) return;
    element.classList.add("exporting");
    try {
      const [width, height] = PDF_SIZES[paperSize];
      const dataUrl = await toPng(element, { pixelRatio: 3, cacheBust: true, backgroundColor: "white", skipFonts: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [width, height], compress: true });
      pdf.addImage(dataUrl, "PNG", 0, 0, width, height, undefined, "FAST");
      await saveBlob(pdf.output("blob"), `${safeFileName(docType, state.meta.number)}.pdf`, "PDF document", ".pdf");
      toast.success("PDF saved successfully.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("The PDF could not be saved. Please try again.");
    } finally {
      element.classList.remove("exporting");
    }
  };
  const printDocument = () => {
    window.print();
  };

  return (
    <div className="studio-shell">
      <style>{`@media print { @page { size: auto; margin: 0; } }`}</style>
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
            <Button type="button" variant="secondary" onClick={downloadPdf}><Download size={16} /> Download PDF</Button>
            <Button type="button" onClick={printDocument}><Printer size={16} /> Print</Button>
          </div>
        </div>
      </header>
       <main className="print-area"><DocumentPaper docType={docType} state={state} setState={setState} paperStyle={paperStyle} paperSize={paperSize} /></main>
      </div>
    </div>
  );
}
