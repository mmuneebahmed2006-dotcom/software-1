import { useEffect, useState } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SavedDocument } from "@/lib/document";

interface DesktopManagementProps {
  documents: SavedDocument[];
}

export function DesktopManagement({ documents: _documents }: DesktopManagementProps) {
  const [available, setAvailable] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  useEffect(() => setAvailable(Boolean(window.desktop)), []);
  if (!available) return null;

  const createBackup = async () => {
    const destination = await window.desktop?.backup();
    if (!destination) return;
    toast.success("Backup created.");
    setBackupOpen(false);
  };

  return <>
    <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
       <DialogTrigger asChild><Button type="button" variant="secondary"><Archive size={16}/> Backup &amp; Restore</Button></DialogTrigger>
      <DialogContent>
         <DialogHeader><DialogTitle>Backup &amp; Restore</DialogTitle><DialogDescription>Save the entire workspace as one ZIP, or restore a previous backup.</DialogDescription></DialogHeader>
         <DialogFooter><Button type="button" variant="outline" onClick={async () => { const result = await window.desktop?.restoreBackup(); if (result) { toast.success(`${result.imported} documents restored.`); window.location.reload(); } }}>Restore Backup</Button><Button type="button" onClick={() => void createBackup()}>Create Backup ZIP</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}