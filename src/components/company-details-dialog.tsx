import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CompanyDetails, CompanyScope } from "@/lib/document";

interface Props { details: CompanyDetails; onSave: (details: CompanyDetails, scope: CompanyScope) => Promise<void> }
export function CompanyDetailsDialog({ details, onSave }: Props) {
  const [open, setOpen] = useState(false); const [scopeOpen, setScopeOpen] = useState(false); const [draft, setDraft] = useState(details);
  useEffect(() => setDraft(details), [details]);
  const field = (key: keyof CompanyDetails, label: string) => <label className="dialog-field"><span>{label}</span><Input aria-label={`Company ${label.toLowerCase()}`} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}/></label>;
  const apply = async (scope: CompanyScope) => { await onSave(draft, scope); setScopeOpen(false); setOpen(false) };
  return <><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="secondary"><Building2 size={16}/> Company Details</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Company Details</DialogTitle><DialogDescription>Edit or clear the information used in documents.</DialogDescription></DialogHeader><div className="dialog-grid">{field("address", "Address")}{field("phone", "Phone")}{field("email", "Email")}{field("website", "Website")}{field("paymentInfo", "Payment information")}</div><DialogFooter><Button type="button" onClick={() => setScopeOpen(true)}>Save Changes</Button></DialogFooter></DialogContent></Dialog><Dialog open={scopeOpen} onOpenChange={setScopeOpen}><DialogContent><DialogHeader><DialogTitle>Apply company details</DialogTitle><DialogDescription>Choose exactly which documents receive these changes.</DialogDescription></DialogHeader><div className="scope-options"><Button type="button" variant="outline" onClick={() => void apply("current")}>Only this document</Button><Button type="button" variant="outline" onClick={() => void apply("future")}>All future documents</Button><Button type="button" variant="outline" onClick={() => void apply("previous")}>All previously saved documents</Button><Button type="button" onClick={() => void apply("all")}>All documents (past and future)</Button></div></DialogContent></Dialog></>;
}