import { memo, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FilePlus2, FileText, Folder, FolderPlus, MoreVertical, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateRangeStart, DOC_LABELS, documentTotal, groupLabel, matchesDateRange, money, type SavedDocument } from "@/lib/document";

export type FolderDownloadMode = "combined" | "separate";

interface Props {
  documents: SavedDocument[];
  activeId: string | null;
  folders: string[];
  activeFolder: string;
  busy?: boolean;
  onSelectFolder: (folder: string) => void;
  onNew: () => void;
  onOpen: (document: SavedDocument) => void;
  onRename: (id: string, title: string) => void | Promise<void>;
  onDelete: (document: SavedDocument) => void;
  onCreateFolder: () => void;
  onRenameFolder: (from: string, to: string) => void | Promise<void>;
  onDeleteFolder: (folder: string) => void | Promise<void>;
  onDownloadFolder: (folder: string, mode: FolderDownloadMode) => void | Promise<void>;
  onDownloadDocument: (document: SavedDocument) => void | Promise<void>;
}

function useDebounced(value: string, delay = 160) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay]);
  return debounced;
}

function SavedDocumentsSidebarComponent({ documents, activeId, folders = [], activeFolder = "General", busy = false, onSelectFolder = () => {}, onNew, onOpen, onRename, onDelete, onCreateFolder, onRenameFolder, onDeleteFolder, onDownloadFolder, onDownloadDocument }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");
  const [draft, setDraft] = useState<{ id: string; value: string } | null>(null);
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [folder, setFolder] = useState("all");
  const [menuFolder, setMenuFolder] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<{ from: string; value: string } | null>(null);
  const [downloadFolder, setDownloadFolder] = useState<string | null>(null);
  const search = useDebounced(query);
  const folderSearch = useDebounced(folderQuery);

  const folderNames = useMemo(() => [...new Set([...(folders ?? []), ...(documents ?? []).map((entry) => entry.folder)])].filter(Boolean).sort(), [folders, documents]);
  const visibleFolders = useMemo(() => folderNames.filter((name) => name.toLowerCase().includes(folderSearch.trim().toLowerCase())), [folderNames, folderSearch]);
  const counts = useMemo(() => documents.reduce<Record<string, number>>((result, entry) => { result[entry.folder] = (result[entry.folder] ?? 0) + 1; return result }, {}), [documents]);

  const groups = useMemo(() => {
    const rangeFrom = range === "custom" ? (from ? new Date(`${from}T00:00:00`).getTime() : undefined) : range === "all" ? undefined : dateRangeStart(Number(range));
    const rangeTo = range === "custom" && to ? new Date(`${to}T23:59:59.999`).getTime() : undefined;
    const folderFilter = folderSearch.trim() ? visibleFolders : null;
    const term = search.toLowerCase();
    const filtered = documents.filter((entry) =>
      `${entry.title} ${entry.state.meta.number} ${entry.state.client.name} ${entry.folder}`.toLowerCase().includes(term)
      && matchesDateRange(entry, rangeFrom, rangeTo)
      && (folder === "all" || entry.folder === folder)
      && (!folderFilter || folderFilter.includes(entry.folder)));
    return filtered.reduce<Record<string, SavedDocument[]>>((result, item) => { const label = groupLabel(item.updatedAt); (result[label] ??= []).push(item); return result }, {});
  }, [documents, search, range, from, to, folder, folderSearch, visibleFolders]);

  const commitDraft = () => { if (draft && draft.value.trim()) void onRename(draft.id, draft.value.trim()); setDraft(null) };

  return <aside className={`no-print saved-sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="sidebar-heading">{!collapsed && <div><span>Workspace</span><h2>Saved Documents</h2></div>}<Button type="button" size="icon" variant="outline" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand saved documents" : "Collapse saved documents"}>{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</Button></div>
    {collapsed ? <Button type="button" size="icon" onClick={onNew} aria-label="New document"><FilePlus2 size={18}/></Button> : <>
      <Button type="button" className="new-document" onClick={onNew}><FilePlus2 size={17}/> New Document</Button>
      <Button type="button" variant="outline" className="new-folder" onClick={onCreateFolder}><FolderPlus size={16}/> New Folder</Button>
      <label className="history-filter"><span>History</span><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Document history date range"><option value="all">All dates</option><option value="3">Last 3 months</option><option value="4">Last 4 months</option><option value="6">Last 6 months</option><option value="custom">Custom range</option></select></label>
      {range === "custom" && <div className="history-custom"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="History start date"/><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="History end date"/></div>}

      <div className="folder-toolbar">
        <button type="button" className={`folder-all ${folder === "all" ? "active" : ""}`} onClick={() => setFolder("all")}>All folders</button>
        <label className="folder-search"><Search size={13}/><input value={folderQuery} onChange={(event) => setFolderQuery(event.target.value)} placeholder="Search folders" aria-label="Search folders"/></label>
      </div>
      <div className="folder-chips">
        {visibleFolders.map((name) => <span key={name} className={`folder-chip ${folder === name ? "active" : ""} ${activeFolder === name ? "current" : ""}`}>
          <button type="button" className="folder-chip-main" onClick={() => { setFolder(name); onSelectFolder(name) }}><Folder size={13}/> {name} <small>{counts[name] ?? 0}</small></button>
          <button type="button" className="folder-chip-menu" aria-label={`Options for ${name}`} onClick={() => setMenuFolder(menuFolder === name ? null : name)}><MoreVertical size={13}/></button>
          {menuFolder === name && <div className="folder-menu" role="menu">
            <button type="button" onClick={() => { setRenamingFolder({ from: name, value: name }); setMenuFolder(null) }}><Pencil size={13}/> Rename</button>
            <button type="button" onClick={() => { setMenuFolder(null); if (window.confirm(`Delete the folder “${name}” and remove its documents from the list?`)) void onDeleteFolder(name) }}><Trash2 size={13}/> Delete</button>
            <button type="button" onClick={() => { setMenuFolder(null); setDownloadFolder(name) }}><Download size={13}/> Download</button>
          </div>}
        </span>)}
        {!visibleFolders.length && <small className="folder-empty">No folders match.</small>}
      </div>

      <label className="document-search"><Search size={16}/><input id="document-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, number, or folder" aria-label="Search saved documents"/></label>
      <div className="saved-list">
        {Object.keys(groups).length === 0 && <div className="saved-empty"><FileText size={23}/><span>{documents.length ? "No documents found" : "No saved documents yet"}</span></div>}
        {Object.entries(groups).map(([label, entries]) => <section className="saved-group" key={label}><h3>{label}</h3>{entries.map((document) => <div key={document.id} className={`saved-item ${activeId === document.id ? "active" : ""}`}>
          <button type="button" className="saved-item-main" onClick={() => onOpen(document)}><FileText size={17}/><span>
            {draft?.id === document.id
              ? <input autoFocus value={draft.value} onClick={(event) => event.stopPropagation()} onChange={(event) => setDraft({ id: document.id, value: event.target.value })} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === "Enter") commitDraft(); if (event.key === "Escape") setDraft(null) }} aria-label="Document title"/>
              : <strong>{document.title}</strong>}
            <small>{document.state.meta.number || DOC_LABELS[document.docType]} · {document.state.client.name || "No client"}</small>
            <small>{document.state.meta.date || "No date"} · {document.folder}</small>
            <small className="saved-item-total">{document.docType === "dc" ? "No pricing" : money(documentTotal(document.state, document.docType), document.state.currency)}</small>
          </span></button>
          <div className="saved-item-actions">
            <Button type="button" size="icon" variant="outline" disabled={busy} onClick={() => void onDownloadDocument(document)} aria-label={`Download ${document.title} as PDF`}><Download size={14}/></Button>
            <Button type="button" size="icon" variant="outline" onClick={() => setDraft({ id: document.id, value: document.title })} aria-label={`Rename ${document.title}`}><Pencil size={14}/></Button>
            <Button type="button" size="icon" variant="danger" onClick={() => onDelete(document)} aria-label={`Delete ${document.title}`}><Trash2 size={14}/></Button>
          </div>
        </div>)}</section>)}
      </div>
    </>}

    <Dialog open={Boolean(renamingFolder)} onOpenChange={(open) => !open && setRenamingFolder(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rename folder</DialogTitle><DialogDescription>The new name is saved straight away.</DialogDescription></DialogHeader>
        <label className="dialog-field"><span>Folder name</span><input autoFocus value={renamingFolder?.value ?? ""} onChange={(event) => setRenamingFolder((current) => current ? { ...current, value: event.target.value } : current)} aria-label="Folder name"/></label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setRenamingFolder(null)}>Cancel</Button>
          <Button type="button" disabled={!renamingFolder?.value.trim()} onClick={() => { if (renamingFolder?.value.trim()) void onRenameFolder(renamingFolder.from, renamingFolder.value.trim()); setRenamingFolder(null) }}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(downloadFolder)} onOpenChange={(open) => !open && setDownloadFolder(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Download “{downloadFolder}”</DialogTitle><DialogDescription>Choose how the documents in this folder are downloaded.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { const name = downloadFolder; setDownloadFolder(null); if (name) void onDownloadFolder(name, "separate") }}>Separate PDFs (ZIP)</Button>
          <Button type="button" disabled={busy} onClick={() => { const name = downloadFolder; setDownloadFolder(null); if (name) void onDownloadFolder(name, "combined") }}>Combine into one PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </aside>;
}

export const SavedDocumentsSidebar = memo(SavedDocumentsSidebarComponent);
