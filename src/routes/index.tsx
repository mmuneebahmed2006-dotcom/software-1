import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CopyPlus, Download, FileText, Loader2, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { DocumentPaper } from "@/components/document-paper";
import { DesktopManagement } from "@/components/desktop-management";
import { CompanyDetailsDialog } from "@/components/company-details-dialog";
import { SaveDocumentDialog } from "@/components/save-document-dialog";
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
const styleFor = (size: PaperSizeKey) => ({ "--paper-width": PAPER_SIZES[size].width, "--paper-height": PAPER_SIZES[size].height, "--paper-scale": PAPER_SIZES[size].scale } as CSSProperties);

export const Route = createFileRoute("/")({ head: () => ({ meta: [{ title: "Document Studio | 8 Ways Communications" }, { name: "description", content: "Create and manage print-ready invoices, quotations, delivery challans, and sales tax invoices." }, { property: "og:title", content: "Document Studio | 8 Ways Communications" }, { property: "og:description", content: "Create and manage professional print-ready business documents." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Index });

function Index() {
  const [docType, setDocType] = useState<DocType>("invoice");
  const [paperSize, setPaperSize] = useState<PaperSizeKey>("A4");
  const { state, setState, reset, undo, redo } = useHistoryState(createBlankDocumentState);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState("General");
  const { documents, setDocuments } = useSavedDocuments();
  const [folders, setFolders] = useState<string[]>(["General"]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveFolder, setSaveFolder] = useState("General");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<CompanyDetails>(() => companyFromState(createBlankDocumentState()));
  const [renderTarget, setRenderTarget] = useState<SavedDocument | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<(() => void) | null>(null);

  const paper = PAPER_SIZES[paperSize];
  const paperStyle = useMemo(() => styleFor(paperSize), [paperSize]);

  const newDocument = useCallback(() => { setActiveId(null); setActiveFolder("General"); setDocType("invoice"); setPaperSize("A4"); reset(applyCompanyDetails(createBlankDocumentState(), company)) }, [company, reset]);
  const openDocument = useCallback((entry: SavedDocument) => { setActiveId(entry.id); setActiveFolder(entry.folder); setDocType(entry.docType); setPaperSize(entry.paperSize); reset(entry.state) }, [reset]);

  // Off-screen renderer used to export saved documents without opening them.
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

  // Save Document stores data only — PDFs are produced by the download/export actions.
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

  const printDocument = useCallback(() => window.print(), []);

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

  const storeFolders = useCallback((next: string[]) => { setFolders(next); if (!window.desktop) window.localStorage.setItem(`8wc-folders-${docType}`, JSON.stringify(next)) }, [docType]);

  useEffect(() => {
    const load = async () => {
      if (window.desktop) { setFolders(await window.desktop.listFolders(docType)); setCompany(await window.desktop.getCompanyDetails()) }
      else {
        const raw = window.localStorage.getItem("8wc-company-details"); if (raw) setCompany(JSON.parse(raw) as CompanyDetails);
        const stored = window.localStorage.getItem(`8wc-folders-${docType}`); setFolders(stored ? JSON.parse(stored) as string[] : ["General"]);
      }
    };
    void load();
  }, [docType]);

  const createFolder = useCallback(async () => {
    const clean = folderName.trim(); if (!clean) return;
    setActiveFolder(clean);
    storeFolders(window.desktop ? await window.desktop.createFolder(docType, clean) : [...new Set([...folders, clean])]);
    setFolderOpen(false); setFolderName("");
    toast.success(`Folder “${clean}” created and selected.`);
  }, [docType, folderName, folders, storeFolders]);

  const renameFolder = useCallback(async (from: string, to: string) => {
    if (from === to) return;
    storeFolders(window.desktop && window.desktop.renameFolder ? await window.desktop.renameFolder(docType, from, to) : [...new Set(folders.map((entry) => entry === from ? to : entry))]);
    setDocuments((list) => list.map((entry) => entry.docType === docType && entry.folder === from ? { ...entry, folder: to } : entry));
    if (activeFolder === from) setActiveFolder(to);
    toast.success(`Folder renamed to “${to}”.`);
  }, [activeFolder, docType, folders, setDocuments, storeFolders]);

  const deleteFolder = useCallback(async (folder: string) => {
    if (window.desktop?.deleteFolder) { storeFolders(await window.desktop.deleteFolder(docType, folder)); setDocuments(await window.desktop.listDocuments()) }
    else { storeFolders(folders.filter((entry) => entry !== folder)); setDocuments((list) => list.filter((entry) => !(entry.docType === docType && entry.folder === folder))) }
    if (activeFolder === folder) setActiveFolder("General");
    toast.success(`Folder “${folder}” deleted.`);
  }, [activeFolder, docType, folders, setDocuments, storeFolders]);

  const renameDocument = useCallback(async (id: string, title: string) => {
    const entry = documents.find((item) => item.id === id); if (!entry) return;
    const renamed = window.desktop ? await window.desktop.renameDocument(entry, title) : { ...entry, title, updatedAt: Date.now() };
    setDocuments((list) => list.map((item) => item.id === id ? renamed : item));
    toast.success("Document renamed.");
  }, [documents, setDocuments]);

  const deleteDocument = useCallback(async (entry: SavedDocument) => {
    if (!window.confirm("Delete this saved document?")) return;
    if (window.desktop) await window.desktop.deleteDocument(entry);
    setDocuments((list) => list.filter((item) => item.id !== entry.id));
    if (activeId === entry.id) newDocument();
  }, [activeId, newDocument, setDocuments]);

  const saveCompany = useCallback(async (details: CompanyDetails, scope: CompanyScope) => {
    if (scope === "current" || scope === "all") setState((current) => applyCompanyDetails(current, details));
    if (scope === "future" || scope === "all") { setCompany(details); if (window.desktop) await window.desktop.saveCompanyDetails(details); else window.localStorage.setItem("8wc-company-details", JSON.stringify(details)) }
    if (scope === "previous" || scope === "all") { if (window.desktop) setDocuments(await window.desktop.updatePreviousCompanyDetails(details)); else setDocuments((list) => list.map((entry) => ({ ...entry, state: applyCompanyDetails(entry.state, details), updatedAt: Date.now() }))) }
    toast.success("Company details applied.");
  }, [setDocuments, setState]);

  return <div className="studio-shell">
    <style>{`@media print { @page { size: ${paper.page} portrait; margin: 0; } }`}</style>
    <StartupExperience/>
    <SaveDocumentDialog open={saveOpen} title={saveTitle} folder={saveFolder} folders={folders} onTitle={setSaveTitle} onFolder={setSaveFolder} onCancel={() => setSaveOpen(false)} onSave={() => { setSaveOpen(false); void saveRecord(saveTitle.trim(), saveFolder, true) }}/>
    <NewFolderDialog open={folderOpen} value={folderName} category={DOC_LABELS[docType]} onValue={setFolderName} onCancel={() => setFolderOpen(false)} onCreate={() => void createFolder()}/>
    <SavedDocumentsSidebar documents={documents} activeId={activeId} folders={folders} activeFolder={activeFolder} busy={busy} onSelectFolder={setActiveFolder} onNew={newDocument} onOpen={openDocument} onRename={renameDocument} onDelete={deleteDocument} onCreateFolder={() => setFolderOpen(true)} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onDownloadFolder={downloadFolder} onDownloadDocument={downloadSaved}/>
    <div className="studio-main">
      <header className="no-print toolbar"><div className="toolbar-inner">
        <div className="studio-brand"><FileText size={19}/><span>Document Studio</span></div>
        <div className="toolbar-actions">
          <label className="select-control"><span>Choose Document</span><select value={docType} onChange={(event) => { setDocType(event.target.value as DocType); setActiveFolder("General") }} aria-label="Choose Document">{DOC_ORDER.map((type) => <option key={type} value={type}>{DOC_LABELS[type]}</option>)}</select></label>
          <label className="select-control"><span>Currency</span><select value={state.currency} onChange={(event) => setState((current) => ({ ...current, currency: event.target.value }))} aria-label="Currency">{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency.trim()}</option>)}</select></label>
          <label className="select-control"><span>Paper</span><select value={paperSize} onChange={(event) => setPaperSize(event.target.value as PaperSizeKey)} aria-label="Paper size">{PAPER_ORDER.map((size) => <option key={size}>{size}</option>)}</select></label>
          <label className="select-control"><span>Add Custom Pages</span><input type="number" min={1} max={99} value={state.minimumPages} onChange={(event) => setState((current) => ({ ...current, minimumPages: Math.min(99, Math.max(1, event.target.valueAsNumber || 1)) }))} aria-label="Minimum custom pages"/></label>
          <Button type="button" variant="secondary" onClick={() => void persist(false)}><Save size={16}/> Save Document</Button>
          {activeId && <Button type="button" variant="secondary" onClick={() => void persist(true)}><CopyPlus size={16}/> Save As…</Button>}
          <CompanyDetailsDialog details={companyFromState(state)} onSave={saveCompany}/>
          <DesktopManagement documents={documents}/>
          <Button type="button" variant="secondary" disabled={busy} onClick={downloadPdf}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} Download PDF</Button>
          <Button type="button" onClick={printDocument}><Printer size={16}/> Print</Button>
        </div>
      </div></header>
      <main className="print-area"><DocumentPaper docType={docType} state={state} setState={setState} paperStyle={paperStyle} paperSize={paperSize}/></main>
    </div>
    {renderTarget && <div ref={hostRef} className="pdf-render-host no-print" aria-hidden><DocumentPaper docType={renderTarget.docType} state={renderTarget.state} setState={noopSetState} paperStyle={styleFor(renderTarget.paperSize)} paperSize={renderTarget.paperSize}/></div>}
  </div>;
}
