import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { buildPrintHtml, pageRangeIndices, selectPageRanges } from "../../print-layout.mjs";
import { createFileRoute } from "@tanstack/react-router";
import { CopyPlus, Download, FileText, Loader2, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { DocumentPaper } from "@/components/document-paper";
import { DesktopManagement } from "@/components/desktop-management";
import { CompanyDetailsDialog } from "@/components/company-details-dialog";
import { SaveDocumentDialog } from "@/components/save-document-dialog";
import { PrintPreview, type PrintSettings } from "@/components/print-preview";
import { NewFolderDialog } from "@/components/new-folder-dialog";
import { SavedDocumentsSidebar, type FolderDownloadMode } from "@/components/saved-documents-sidebar";
import { StartupExperience } from "@/components/startup-experience";
import { Button } from "@/components/ui/button";
import { useHistoryState } from "@/hooks/use-history-state";
import { useSavedDocuments } from "@/hooks/use-saved-documents";
import { buildPdf, capturePages, saveFile, type CapturedDocument } from "@/lib/pdf";
import { CURRENCIES, DOC_LABELS, PAPER_SIZES, applyCompanyDetails, companyFromState, createBlankDocumentState, safeFileName, uid, type CompanyDetails, type CompanyScope, type DocState, type DocType, type PaperSizeKey, type SavedDocument } from "@/lib/document";

const DOC_ORDER: DocType[] = ["invoice", "quotation", "dc", "tax"];
const PAPER_ORDER: PaperSizeKey[] = ["A4", "A5", "Letter", "Legal"];
const noopSetState: Dispatch<SetStateAction<DocState>> = () => {};
const styleFor = (size: PaperSizeKey) => ({ "--paper-width": PAPER_SIZES[size].width, "--paper-height": PAPER_SIZES[size].height, "--paper-scale": PAPER_SIZES[size].scale, "--print-margin": PAPER_SIZES[size].printMargin } as CSSProperties);

export const Route = createFileRoute("/")({ head: () => ({ meta: [{ title: "Document Studio | 8 Ways Communications" }, { name: "description", content: "Create and manage print-ready invoices, quotations, and delivery challans." }] }), component: Index });

function Index() {
  const [docType, setDocType] = useState<DocType>("invoice");
  const [paperSize, setPaperSize] = useState<PaperSizeKey>("A4");
  const { state, setState, reset, undo, redo } = useHistoryState(createBlankDocumentState);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState("");
  const { documents, setDocuments } = useSavedDocuments();
  const [folders, setFolders] = useState<string[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveFolder, setSaveFolder] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printCapture, setPrintCapture] = useState<CapturedDocument | null>(null);
  const [company, setCompany] = useState<CompanyDetails>(() => companyFromState(createBlankDocumentState()));
  const [renderTarget, setRenderTarget] = useState<SavedDocument | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<(() => void) | null>(null);

  const paper = PAPER_SIZES[paperSize];
  const paperStyle = useMemo(() => styleFor(paperSize), [paperSize]);

  const newDocument = useCallback(() => { setActiveId(null); setActiveFolder(""); setDocType("invoice"); setPaperSize("A4"); reset(applyCompanyDetails(createBlankDocumentState(), company)) }, [company, reset]);
  const openDocument = useCallback((entry: SavedDocument) => { setActiveId(entry.id); setActiveFolder(entry.folder); setDocType(entry.docType); setPaperSize(entry.paperSize); reset(entry.state) }, [reset]);

  useEffect(() => { if (renderTarget && readyRef.current) { const resolve = readyRef.current; readyRef.current = null; requestAnimationFrame(() => requestAnimationFrame(resolve)) } }, [renderTarget]);
  const captureSaved = useCallback(async (entry: SavedDocument): Promise<CapturedDocument> => {
    await new Promise<void>((resolve) => { readyRef.current = resolve; setRenderTarget(entry) });
    try { if (!hostRef.current) throw new Error("Render host unavailable"); return await capturePages(hostRef.current, entry.paperSize) }
    finally { setRenderTarget(null) }
  }, []);
  const captureCurrent = useCallback(() => capturePages(document.getElementById("document-pages") ?? document, paperSize), [paperSize]);

  const runExport = useCallback(async (label: string, task: () => Promise<boolean | null>) => {
    if (busy) return;
    setBusy(true);
    const pending = toast.loading(label);
    try { const saved = await task(); toast.dismiss(pending); if (saved) toast.success("PDF file is saved"); }
    catch { toast.dismiss(pending); toast.error("The file could not be created."); }
    finally { setBusy(false) }
  }, [busy]);

  const downloadPdf = useCallback(() => void runExport("Preparing PDF…", async () => {
    const blob = buildPdf([await captureCurrent()]);
    return saveFile(blob, `${safeFileName(docType, state.meta.number)}.pdf`, "application/pdf", docType);
  }), [captureCurrent, docType, runExport, state.meta.number]);

  const downloadSaved = useCallback((entry: SavedDocument) => void runExport("Preparing PDF…", async () => {
    const blob = buildPdf([await captureSaved(entry)]);
    return saveFile(blob, `${safeFileName(entry.docType, entry.state.meta.number)}.pdf`, "application/pdf", entry.docType);
  }), [captureSaved, runExport]);

  const downloadFolder = useCallback((folder: string, mode: FolderDownloadMode) => {
    const entries = documents.filter((entry) => entry.docType === docType && entry.folder === folder);
    if (!entries.length) { toast.error("This folder has no saved documents."); return }
    void runExport(`Preparing ${entries.length} document${entries.length === 1 ? "" : "s"}…`, async () => {
      if (mode === "combined") {
        const captured: CapturedDocument[] = [];
        for (const entry of entries) captured.push(await captureSaved(entry));
        return saveFile(buildPdf(captured), `${folder.replaceAll(" ", "_")}.pdf`, "application/pdf", docType);
      }
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const entry of entries) zip.file(`${safeFileName(entry.docType, entry.state.meta.number)}-${entry.id.slice(0, 6)}.pdf`, buildPdf([await captureSaved(entry)]));
      return saveFile(await zip.generateAsync({ type: "blob" }), `${folder.replaceAll(" ", "_")}-PDFs.zip`, "application/zip");
    });
  }, [captureSaved, docType, documents, runExport]);

  const saveRecord = useCallback(async (title: string, folder: string, asCopy: boolean) => {
    const now = Date.now();
    const current = !asCopy ? documents.find((entry) => entry.id === activeId) : undefined;
    let saved: SavedDocument = { id: current?.id ?? uid(), title, docType, paperSize, state, folder, createdAt: current?.createdAt ?? now, updatedAt: now, storagePath: current?.storagePath };
    if (window.desktop) saved = await window.desktop.saveDocument(saved);
    setDocuments((list) => [saved, ...list.filter((entry) => entry.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    setActiveId(saved.id);
    setActiveFolder(folder);
    toast.success(asCopy ? "New copy saved." : "Document saved.");
  }, [activeId, docType, documents, paperSize, setDocuments, state]);

  const persist = useCallback(async (asCopy = false) => {
    const current = !asCopy ? documents.find((entry) => entry.id === activeId) : undefined;
    if (!current) { setSaveTitle(`${DOC_LABELS[docType]} ${state.meta.number || documents.length + 1}`); setSaveFolder(activeFolder); setSaveOpen(true); return }
    await saveRecord(current.title, current.folder, false);
  }, [activeFolder, activeId, docType, documents, saveRecord, state.meta.number]);

  const printDocument = useCallback(async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const captured = await captureCurrent();
      setPrintCapture(captured);
      setPrintOpen(true);
    } catch {
      toast.error("The print preview could not be created.");
    } finally {
      setIsPrinting(false);
    }
  }, [captureCurrent, isPrinting]);

  const executePrint = useCallback(async (settings: PrintSettings) => {
    // The print preview owns all print settings. Submit one silent Electron
    // print job directly to the selected Windows printer; never call
    // window.print(), because that opens the browser/native print dialog.
    if (!printCapture?.images?.length) { toast.error("Nothing to print."); return; }

    const pageRanges = selectPageRanges(printCapture.images.length, settings);

    const scale = settings.sizing === "custom"
      ? Math.min(400, Math.max(10, Number(settings.scale) || 100))
      : settings.sizing === "actual" ? 100 : 96;

    const paperSize = ({
      "A4 21 × 29.7 cm": "A4",
      "A5 14.8 × 21 cm": "A5",
      "Letter 8.5 × 11 in": "Letter",
      "Legal 8.5 × 14 in": "Legal",
    } as Record<string, string>)[settings.paperSize] ?? "A4";

    if (!window.desktop?.printDocument) {
      const indices = pageRangeIndices(printCapture.images.length, pageRanges);
      const pages = indices.map((index) => printCapture.images[index]);
      if (!pages.length) { toast.error("The selected page range is empty."); return; }
      const html = buildPrintHtml({
        paperSize, sourceSize: printCapture.size,
        landscape: settings.orientation === "landscape",
        sizing: settings.sizing, scaleFactor: scale,
        autoRotate: settings.autoRotate, autoCenter: settings.autoCenter,
        mode: settings.mode, posterScale: settings.posterScale, posterOverlap: settings.posterOverlap,
        posterCutMarks: settings.posterCutMarks, posterLabels: settings.posterLabels,
        pagesPerSheet: settings.pagesPerSheet, multiplePageOrder: settings.multiplePageOrder,
        bookletSubset: settings.bookletSubset, bookletFrom: settings.bookletFrom,
        bookletTo: settings.bookletTo, bookletBinding: settings.bookletBinding, gray: settings.gray,
      }, pages);
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
      document.body.append(frame);
      const doc = frame.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      await Promise.all(Array.from(doc.images).map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      window.setTimeout(() => frame.remove(), 2000);
      setPrintOpen(false);
      return;
    }

    try {
      const printResult = await window.desktop.printDocument({
        sourceSize: printCapture.size,
        silent: true,
        deviceName: settings.printerName || undefined,
        gray: settings.gray,
        landscape: settings.orientation === "landscape",
        sizing: settings.sizing,
        scaleFactor: scale,
        pagesPerSheet: settings.mode === "size" ? 1 : settings.pagesPerSheet,
        copies: settings.copies,
        pageRanges,
        duplex: settings.mode === "booklet"
          ? settings.bookletSubset === "both" ? "shortEdge" : "simplex"
          : settings.sides === "double" ? "longEdge" : "simplex",
        paperSize,
        dpi: settings.printAsImage ? settings.dpi : undefined,
        images: printCapture.images,
        autoRotate: settings.autoRotate,
        autoCenter: settings.autoCenter,
        mode: settings.mode,
        posterTiles: Math.min(4, Math.max(2, Math.ceil(settings.posterScale / 100))) as 2 | 3 | 4,
        posterScale: settings.posterScale,
        posterOverlap: settings.posterOverlap,
        posterCutMarks: settings.posterCutMarks,
        posterLabels: settings.posterLabels,
        multiplePageOrder: settings.multiplePageOrder,
        bookletSubset: settings.bookletSubset,
        bookletFrom: settings.bookletFrom,
        bookletTo: settings.bookletTo,
        bookletBinding: settings.bookletBinding,
      });

      if (printResult?.cancelled) return;
      if (!printResult?.success) {
        toast.error(`Print failed: ${printResult?.failureReason || "Windows rejected the print job."}`);
        return;
      }

      toast.success("Print sent to the selected printer.");
      setPrintOpen(false);
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Print could not be started.");
    }
  }, [printCapture]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "p") { event.preventDefault(); printDocument() }
      else if (key === "s") { event.preventDefault(); void persist(event.shiftKey && Boolean(activeId)) }
      else if (key === "n") { event.preventDefault(); newDocument() }
      else if (key === "f") { event.preventDefault(); document.getElementById("document-search-input")?.focus() }
      else if (key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo() }
      else if (key === "y") { event.preventDefault(); redo() }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, newDocument, persist, printDocument, redo, undo]);

  const openFolderDialog = useCallback(() => { setFolderOpen(true); }, []);

  const storeFolders = useCallback((next: string[]) => { setFolders(next); if (!window.desktop) window.localStorage.setItem(`8wc-folders-${docType}`, JSON.stringify(next)) }, [docType]);

  useEffect(() => {
    const load = async () => {
      if (window.desktop) { setFolders(await window.desktop.listFolders(docType)); setCompany(await window.desktop.getCompanyDetails()) }
      else {
        const raw = window.localStorage.getItem("8wc-company-details"); if (raw) setCompany(JSON.parse(raw) as CompanyDetails);
        const stored = window.localStorage.getItem(`8wc-folders-${docType}`); setFolders(stored ? JSON.parse(stored) as string[] : []);
      }
    };
    void load();
  }, [docType]);

  const createFolder = useCallback(async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try {
      const next = window.desktop ? await window.desktop.createFolder(docType, clean) : [...new Set([...folders, clean])];
      storeFolders(next);
      setActiveFolder(clean);
      setFolderOpen(false);
      toast.success(`Folder "${clean}" created and selected.`);
    } catch (error) {
      console.error("Folder creation failed:", error);
      toast.error("The folder could not be created. Please try again.");
    }
  }, [docType, folders, storeFolders]);

  const renameFolder = useCallback(async (from: string, to: string) => {
    if (from === to) return;
    try {
      if (window.desktop?.renameFolder) {
        storeFolders(await window.desktop.renameFolder(docType, from, to));
        // Reload storage paths after the directory move so later card actions
        // address the moved files rather than their old paths.
        setDocuments(await window.desktop.listDocuments());
      } else {
        storeFolders([...new Set(folders.map((entry) => entry === from ? to : entry))]);
        setDocuments((list) => list.map((entry) => entry.docType === docType && entry.folder === from ? { ...entry, folder: to } : entry));
      }
      if (activeFolder === from) setActiveFolder(to);
      toast.success(`Folder renamed to "${to}".`);
    } catch (error) {
      console.error("Folder rename failed:", error);
      toast.error("The folder could not be renamed. Please try again.");
    }
  }, [activeFolder, docType, folders, setDocuments, storeFolders]);

  const deleteFolder = useCallback(async (folder: string) => {
    if (window.desktop?.deleteFolder) { storeFolders(await window.desktop.deleteFolder(docType, folder)); setDocuments(await window.desktop.listDocuments()) }
    else { storeFolders(folders.filter((entry) => entry !== folder)); setDocuments((list) => list.filter((entry) => !(entry.docType === docType && entry.folder === folder))) }
    if (activeFolder === folder) setActiveFolder("");
    toast.success(`Folder "${folder}" deleted.`);
  }, [activeFolder, docType, folders, setDocuments, storeFolders]);

  const renameDocument = useCallback(async (id: string, title: string) => {
    const cleanTitle = title.trim();
    const entry = documents.find((item) => item.id === id);
    if (!entry || !cleanTitle) return;
    try {
      const renamed = window.desktop ? await window.desktop.renameDocument(entry, cleanTitle) : { ...entry, title: cleanTitle, updatedAt: Date.now() };
      setDocuments((list) => list.map((item) => item.id === id ? renamed : item));
      toast.success("Document renamed.");
    } catch (error) {
      console.error("Document rename failed:", error);
      toast.error("The document could not be renamed. Please try again.");
    }
  }, [documents, setDocuments]);

  const deleteDocument = useCallback(async (entry: SavedDocument) => {
    try {
      if (window.desktop) await window.desktop.deleteDocument(entry);
      setDocuments((list) => list.filter((item) => item.id !== entry.id));
      if (activeId === entry.id) newDocument();
      toast.success("Document deleted.");
    } catch (error) {
      console.error("Document delete failed:", error);
      toast.error("The document could not be deleted. Please try again.");
    }
  }, [activeId, newDocument, setDocuments]);

  const saveCompany = useCallback(async (details: CompanyDetails, scope: CompanyScope) => {
    if (scope === "current" || scope === "all") setState((current) => applyCompanyDetails(current, details));
    if (scope === "future" || scope === "all") { setCompany(details); if (window.desktop) await window.desktop.saveCompanyDetails(details); else window.localStorage.setItem("8wc-company-details", JSON.stringify(details)); }
    if (scope === "previous" || scope === "all") { if (window.desktop) setDocuments(await window.desktop.updatePreviousCompanyDetails(details)); else setDocuments((list) => list.map((entry) => ({ ...entry, state: applyCompanyDetails(entry.state, details) }))); }
    toast.success("Company details applied.");
  }, [setDocuments, setState]);

  return <div className="studio-shell">
    <style>{`@media print { @page { size: ${paper.page} portrait; margin: 0; } }`}</style>
    <StartupExperience/>
    <PrintPreview open={printOpen} captured={printCapture} paperLabel={paper.page} fileName={`${DOC_LABELS[docType].replaceAll(" ", "_")}_${state.meta.number || "Untitled"}.pdf`} onClose={() => setPrintOpen(false)} onPaperSizeChange={async (label) => {
              const next = ({"A4 21 × 29.7 cm":"A4","A5 14.8 × 21 cm":"A5","Letter 8.5 × 11 in":"Letter","Legal 8.5 × 14 in":"Legal"} as Record<string, PaperSizeKey>)[label];
              if (!next) return;
              setPaperSize(next);
              await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
              try { setPrintCapture(await capturePages(document.getElementById("document-pages") ?? document, next)); } catch {}
            }} onPrint={executePrint}/>
    <SaveDocumentDialog open={saveOpen} title={saveTitle} folder={saveFolder} folders={folders} onTitle={setSaveTitle} onFolder={setSaveFolder} onCancel={() => setSaveOpen(false)} onSave={() => { void saveRecord(saveTitle, saveFolder, false); setSaveOpen(false); }}/>
    <NewFolderDialog open={folderOpen} category={DOC_LABELS[docType]} onCancel={() => setFolderOpen(false)} onCreate={createFolder}/>
    <SavedDocumentsSidebar documents={documents} docType={docType} activeId={activeId} folders={folders} activeFolder={activeFolder} busy={busy} onSelectFolder={setActiveFolder} onNew={newDocument} onOpen={openDocument} onCreateFolder={openFolderDialog} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onDownloadFolder={downloadFolder} onDownloadDocument={downloadSaved} onRename={renameDocument} onDelete={deleteDocument}/>
    <div className="studio-main">
      <header className="no-print toolbar"><div className="toolbar-inner">
        <div className="studio-brand"><FileText size={19}/><span>Document Studio</span></div>
        <div className="toolbar-actions">
          <label className="select-control"><span>Choose Document</span><select value={docType} onChange={(event) => { setDocType(event.target.value as DocType); setActiveFolder("") }} aria-label="Document type">{DOC_ORDER.map((dt) => <option key={dt} value={dt}>{DOC_LABELS[dt]}</option>)}</select></label>
          <label className="select-control"><span>Currency</span><select value={state.currency} onChange={(event) => setState((current) => ({ ...current, currency: event.target.value }))} aria-label="Currency">{CURRENCIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="select-control"><span>Paper</span><select value={paperSize} onChange={(event) => setPaperSize(event.target.value as PaperSizeKey)} aria-label="Paper size">{PAPER_ORDER.map((size) => { const spec = PAPER_SIZES[size]; return <option key={size} value={size}>{spec.page}</option> })}</select></label>
          <label className="select-control"><span>Add Custom Pages</span><input type="number" min={1} max={99} value={state.minimumPages} onChange={(event) => setState((current) => ({ ...current, minimumPages: Math.max(1, Number(event.target.value) || 1) }))} aria-label="Minimum pages"/></label>
          <Button type="button" variant="secondary" onClick={() => void persist(false)}><Save size={16}/> Save Document</Button>
          {activeId && <Button type="button" variant="secondary" onClick={() => void persist(true)}><CopyPlus size={16}/> Save As…</Button>}
          <CompanyDetailsDialog details={companyFromState(state)} onSave={saveCompany}/>
          <DesktopManagement documents={documents}/>
          <Button type="button" variant="secondary" disabled={busy} onClick={downloadPdf}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} Download PDF</Button>
          <Button type="button" disabled={isPrinting} onClick={printDocument}><Printer size={16}/> Print</Button>
        </div>
      </div></header>
      <main className="print-area"><DocumentPaper docType={docType} state={state} setState={setState} paperStyle={paperStyle} paperSize={paperSize}/></main>
    </div>
    {renderTarget && <div ref={hostRef} className="pdf-render-host no-print" aria-hidden><DocumentPaper docType={renderTarget.docType} state={renderTarget.state} setState={noopSetState} paperStyle={styleFor(renderTarget.paperSize)} paperSize={renderTarget.paperSize}/></div>}
  </div>;
}
