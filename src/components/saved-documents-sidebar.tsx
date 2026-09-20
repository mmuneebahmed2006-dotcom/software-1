import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FilePlus2, FileText, FolderPlus, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOC_LABELS, documentTotal, groupLabel, money, type SavedDocument } from "@/lib/document";

interface Props { documents: SavedDocument[]; activeId: string | null; onNew: () => void; onOpen: (document: SavedDocument) => void; onRename: (id: string, title: string) => void; onDelete: (document: SavedDocument) => void; onCreateFolder: () => void }

export function SavedDocumentsSidebar({ documents, activeId, onNew, onOpen, onRename, onDelete, onCreateFolder }: Props) {
  const [collapsed, setCollapsed] = useState(false); const [query, setQuery] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);
  const groups = useMemo(() => {
    const filtered = documents.filter((d) => `${d.title} ${d.state.meta.number} ${d.folder}`.toLowerCase().includes(query.toLowerCase()));
    return filtered.reduce<Record<string, SavedDocument[]>>((result, item) => { const label = groupLabel(item.updatedAt); (result[label] ??= []).push(item); return result }, {});
  }, [documents, query]);
  return <aside className={`no-print saved-sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="sidebar-heading">{!collapsed && <div><span>Workspace</span><h2>Saved Documents</h2></div>}<Button type="button" size="icon" variant="outline" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand saved documents" : "Collapse saved documents"}>{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</Button></div>
    {collapsed ? <Button type="button" size="icon" onClick={onNew} aria-label="New document"><FilePlus2 size={18}/></Button> : <>
      <Button type="button" className="new-document" onClick={onNew}><FilePlus2 size={17}/> New Document</Button>
      <Button type="button" variant="outline" className="new-folder" onClick={onCreateFolder}><FolderPlus size={16}/> New Folder</Button>
      <label className="document-search"><Search size={16}/><input id="document-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, number, or folder" aria-label="Search saved documents"/></label>
      <div className="saved-list">{Object.keys(groups).length === 0 && <div className="saved-empty"><FileText size={23}/><span>{documents.length ? "No documents found" : "No saved documents yet"}</span></div>}
        {Object.entries(groups).map(([label, entries]) => <section className="saved-group" key={label}><h3>{label}</h3>{entries.map((document) => <div key={document.id} className={`saved-item ${activeId === document.id ? "active" : ""}`}>
          <button type="button" className="saved-item-main" onClick={() => onOpen(document)}><FileText size={17}/><span>{editingId === document.id ? <input autoFocus value={document.title} onClick={(e) => e.stopPropagation()} onChange={(e) => onRename(document.id, e.target.value)} onBlur={() => setEditingId(null)} onKeyDown={(e) => e.key === "Enter" && setEditingId(null)} aria-label="Document title"/> : <strong>{document.title}</strong>}<small>{document.state.meta.number || DOC_LABELS[document.docType]} · {document.state.meta.date || "No date"}</small><small>{document.folder}</small><small className="saved-item-total">{document.docType === "dc" ? "No pricing" : money(documentTotal(document.state, document.docType), document.state.currency)}</small></span></button>
          <div className="saved-item-actions"><Button type="button" size="icon" variant="outline" onClick={() => setEditingId(document.id)} aria-label={`Rename ${document.title}`}><Pencil size={14}/></Button><Button type="button" size="icon" variant="danger" onClick={() => onDelete(document)} aria-label={`Delete ${document.title}`}><Trash2 size={14}/></Button></div>
        </div>)}</section>)}
      </div>
    </>}
  </aside>;
}