import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FilePlus2, FileText, FolderPlus, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateRangeStart, DOC_LABELS, documentTotal, groupLabel, matchesDateRange, money, type SavedDocument } from "@/lib/document";

interface Props { documents: SavedDocument[]; activeId: string | null; folders: string[]; activeFolder: string; onSelectFolder: (folder: string) => void; onNew: () => void; onOpen: (document: SavedDocument) => void; onRename: (id: string, title: string) => void | Promise<void>; onDelete: (document: SavedDocument) => void; onCreateFolder: () => void }

export function SavedDocumentsSidebar({ documents, activeId, folders, activeFolder, onSelectFolder, onNew, onOpen, onRename, onDelete, onCreateFolder }: Props) {
  const [collapsed, setCollapsed] = useState(false); const [query, setQuery] = useState(""); const [editingId, setEditingId] = useState<string | null>(null); const [range, setRange] = useState("all"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const groups = useMemo(() => {
    const rangeFrom = range === "custom" ? (from ? new Date(`${from}T00:00:00`).getTime() : undefined) : range === "all" ? undefined : dateRangeStart(Number(range));
    const rangeTo = range === "custom" && to ? new Date(`${to}T23:59:59.999`).getTime() : undefined;
    const filtered = documents.filter((d) => `${d.title} ${d.state.meta.number} ${d.state.client.name} ${d.folder}`.toLowerCase().includes(query.toLowerCase()) && matchesDateRange(d, rangeFrom, rangeTo) && (folder === "all" || d.folder === folder));
    return filtered.reduce<Record<string, SavedDocument[]>>((result, item) => { const label = groupLabel(item.updatedAt); (result[label] ??= []).push(item); return result }, {});
  }, [documents, query, range, from, to]);
  return <aside className={`no-print saved-sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="sidebar-heading">{!collapsed && <div><span>Workspace</span><h2>Saved Documents</h2></div>}<Button type="button" size="icon" variant="outline" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand saved documents" : "Collapse saved documents"}>{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</Button></div>
    {collapsed ? <Button type="button" size="icon" onClick={onNew} aria-label="New document"><FilePlus2 size={18}/></Button> : <>
      <Button type="button" className="new-document" onClick={onNew}><FilePlus2 size={17}/> New Document</Button>
       <Button type="button" variant="outline" className="new-folder" onClick={onCreateFolder}><FolderPlus size={16}/> New Folder</Button><label className="history-filter"><span>History</span><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Document history date range"><option value="all">All dates</option><option value="3">Last 3 months</option><option value="4">Last 4 months</option><option value="6">Last 6 months</option><option value="custom">Custom range</option></select></label>{range === "custom" && <div className="history-custom"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="History start date"/><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="History end date"/></div>}
      <label className="document-search"><Search size={16}/><input id="document-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, number, or folder" aria-label="Search saved documents"/></label>
      <div className="saved-list">{Object.keys(groups).length === 0 && <div className="saved-empty"><FileText size={23}/><span>{documents.length ? "No documents found" : "No saved documents yet"}</span></div>}
        {Object.entries(groups).map(([label, entries]) => <section className="saved-group" key={label}><h3>{label}</h3>{entries.map((document) => <div key={document.id} className={`saved-item ${activeId === document.id ? "active" : ""}`}>
           <button type="button" className="saved-item-main" onClick={() => onOpen(document)}><FileText size={17}/><span>{editingId === document.id ? <input autoFocus value={document.title} onClick={(e) => e.stopPropagation()} onChange={(e) => onRename(document.id, e.target.value)} onBlur={() => setEditingId(null)} onKeyDown={(e) => e.key === "Enter" && setEditingId(null)} aria-label="Document title"/> : <strong>{document.title}</strong>}<small>{document.state.meta.number || DOC_LABELS[document.docType]} · {document.state.client.name || "No client"}</small><small>{document.state.meta.date || "No date"} · {document.folder}</small><small className="saved-item-total">{document.docType === "dc" ? "No pricing" : money(documentTotal(document.state, document.docType), document.state.currency)}</small></span></button>
          <div className="saved-item-actions"><Button type="button" size="icon" variant="outline" onClick={() => setEditingId(document.id)} aria-label={`Rename ${document.title}`}><Pencil size={14}/></Button><Button type="button" size="icon" variant="danger" onClick={() => onDelete(document)} aria-label={`Delete ${document.title}`}><Trash2 size={14}/></Button></div>
        </div>)}</section>)}
      </div>
    </>}
  </aside>;
}