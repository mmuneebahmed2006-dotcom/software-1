import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props { open: boolean; category: string; onCancel: () => void; onCreate: (name: string) => void | Promise<void> }

export function NewFolderDialog({ open, category, onCancel, onCreate }: Props) {
  const [value, setValue] = useState("");
  useEffect(() => { if (open) setValue(""); }, [open]);

  const create = () => {
    const name = value.trim();
    if (name) void onCreate(name);
  };

  return <Dialog open={open} onOpenChange={(next) => !next && onCancel()}><DialogContent><DialogHeader><DialogTitle>New {category} folder</DialogTitle><DialogDescription>This folder will be created on disk inside the current document category.</DialogDescription></DialogHeader><label className="dialog-field"><span>Folder name</span><Input autoFocus value={value} onChange={(event) => setValue(event.target.value)} aria-label="New folder name" onKeyDown={(event) => { if (event.key === "Enter" && value.trim()) { event.preventDefault(); create(); } }}/></label><DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="button" disabled={!value.trim()} onClick={create}>Create Folder</Button></DialogFooter></DialogContent></Dialog>;
}