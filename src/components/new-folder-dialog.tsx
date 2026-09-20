import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props { open: boolean; value: string; category: string; onValue: (value: string) => void; onCancel: () => void; onCreate: () => void }

export function NewFolderDialog({ open, value, category, onValue, onCancel, onCreate }: Props) {
  return <Dialog open={open} onOpenChange={(next) => !next && onCancel()}><DialogContent><DialogHeader><DialogTitle>New {category} folder</DialogTitle><DialogDescription>This folder will be created on disk inside the current document category.</DialogDescription></DialogHeader><label className="dialog-field"><span>Folder name</span><Input autoFocus value={value} onChange={(event) => onValue(event.target.value)} aria-label="New folder name" onKeyDown={(event) => event.key === "Enter" && value.trim() && onCreate()}/></label><DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="button" disabled={!value.trim()} onClick={onCreate}>Create Folder</Button></DialogFooter></DialogContent></Dialog>;
}