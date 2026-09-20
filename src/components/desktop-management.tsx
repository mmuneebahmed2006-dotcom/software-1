import { useEffect, useMemo, useState } from "react";
import { Archive, FolderDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SavedDocument } from "@/lib/document";

interface DesktopManagementProps {
  documents: SavedDocument[];
}

const startOfDay = (value: string) => value ? new Date(`${value}T00:00:00`).getTime() : undefined;
const endOfDay = (value: string) => value ? new Date(`${value}T23:59:59.999`).getTime() : undefined;

export function DesktopManagement({ documents }: DesktopManagementProps) {
  const [available, setAvailable] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => setAvailable(Boolean(window.desktop)), []);
  const allSelected = documents.length > 0 && selected.length === documents.length;
  const grouped = useMemo(() => Object.entries(documents.reduce<Record<string, SavedDocument[]>>((groups, document) => {
    const folder = document.folder || "General";
    groups[folder] = [...(groups[folder] ?? []), document];
    return groups;
  }, {})), [documents]);
  if (!available) return null;

  const exportSelected = async () => {
    const count = await window.desktop?.exportSelected(selected, startOfDay(from), endOfDay(to));
    if (typeof count !== "number") return;
    toast.success(`${count} PDF${count === 1 ? "" : "s"} exported.`);
    setExportOpen(false);
  };

  const createBackup = async () => {
    const destination = await window.desktop?.backup();
    if (!destination) return;
    toast.success("Backup created.");
    setBackupOpen(false);
  };

  return <>
    <Dialog open={exportOpen} onOpenChange={setExportOpen}>
      <DialogTrigger asChild><Button type="button" variant="secondary"><FolderDown size={16}/> Export PDFs</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Export saved PDFs</DialogTitle><DialogDescription>Select the documents to copy into a folder.</DialogDescription></DialogHeader>
        <label className="management-check"><Checkbox checked={allSelected} onCheckedChange={(checked) => setSelected(checked ? documents.map((document) => document.id) : [])}/><strong>Select All</strong></label>
         <div className="backup-dates"><label><span>From</span><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label><span>To</span><Input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label></div><div className="management-list">
          {grouped.map(([folder, entries]) => <section key={folder}><h3>{folder}</h3>{entries?.map((document) => <label className="management-check" key={document.id}><Checkbox checked={selected.includes(document.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...new Set([...current, document.id])] : current.filter((id) => id !== document.id))}/><span>{document.title}</span></label>)}</section>)}
          {!documents.length && <p>No saved documents are available.</p>}
        </div>
        <DialogFooter><Button type="button" disabled={!selected.length} onClick={() => void exportSelected()}>Choose Folder & Export</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
       <DialogTrigger asChild><Button type="button" variant="secondary"><Archive size={16}/> Backup &amp; Restore</Button></DialogTrigger>
      <DialogContent>
         <DialogHeader><DialogTitle>Backup &amp; Restore</DialogTitle><DialogDescription>Save the entire workspace as one ZIP, or restore a previous backup.</DialogDescription></DialogHeader>
         <DialogFooter><Button type="button" variant="outline" onClick={async () => { const result = await window.desktop?.restoreBackup(); if (result) { toast.success(`${result.imported} documents restored.`); window.location.reload(); } }}>Restore Backup</Button><Button type="button" onClick={() => void createBackup()}>Create Backup ZIP</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}