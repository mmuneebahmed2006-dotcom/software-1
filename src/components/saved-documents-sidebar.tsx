import { useState } from "react";
import { ChevronLeft, ChevronRight, FilePlus2, FileText, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOC_LABELS, documentTotal, money, type SavedDocument } from "@/lib/document";

interface Props {
  documents: SavedDocument[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (document: SavedDocument) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function SavedDocumentsSidebar({ documents, activeId, onNew, onOpen, onRename, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = documents.filter((document) => `${document.title} ${document.state.meta.number}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside className={`no-print saved-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-heading">
        {!collapsed && <div><span>Workspace</span><h2>Saved Documents</h2></div>}
        <Button type="button" size="icon" variant="outline" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand saved documents" : "Collapse saved documents"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </Button>
      </div>
      {collapsed ? (
        <Button type="button" size="icon" onClick={onNew} aria-label="New document" title="New document"><FilePlus2 size={18} /></Button>
      ) : (
        <>
          <Button type="button" className="new-document" onClick={onNew}><FilePlus2 size={17} /> New Document</Button>
          <label className="document-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or number" aria-label="Search saved documents" /></label>
          <div className="saved-list">
            {filtered.length === 0 && <div className="saved-empty"><FileText size={23} /><span>{documents.length ? "No documents found" : "No saved documents yet"}</span></div>}
            {filtered.map((document) => (
              <div key={document.id} className={`saved-item ${activeId === document.id ? "active" : ""}`}>
                <button type="button" className="saved-item-main" onClick={() => onOpen(document)}>
                  <FileText size={17} />
                  <span>
                    {editingId === document.id ? (
                      <input autoFocus value={document.title} onClick={(event) => event.stopPropagation()} onChange={(event) => onRename(document.id, event.target.value)} onBlur={() => setEditingId(null)} onKeyDown={(event) => event.key === "Enter" && setEditingId(null)} aria-label="Document title" />
                    ) : <strong>{document.title}</strong>}
                    <small>{document.state.meta.number || DOC_LABELS[document.docType]} · {document.state.meta.date || "No date"}</small>
                    <small className="saved-item-total">{document.docType === "dc" ? "No pricing" : money(documentTotal(document.state, document.docType), document.state.currency)}</small>
                  </span>
                </button>
                <div className="saved-item-actions">
                  <Button type="button" size="icon" variant="outline" onClick={() => setEditingId(document.id)} aria-label={`Rename ${document.title}`} title="Rename"><Pencil size={14} /></Button>
                  <Button type="button" size="icon" variant="danger" onClick={() => onDelete(document.id)} aria-label={`Delete ${document.title}`} title="Delete"><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}