import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { Globe2, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/8-ways-communications-logo.jpg.asset.json";
import { DOC_LABELS, money, uid, type DocState, type DocType, type LineItem, type PaperSizeKey } from "@/lib/document";
import { Button } from "@/components/ui/button";
import { AreaField, NumberField, TextField } from "@/components/field";

interface Props {
  docType: DocType;
  state: DocState;
  setState: Dispatch<SetStateAction<DocState>>;
  paperStyle: CSSProperties;
  paperSize: PaperSizeKey;
}

const MAX_ITEMS = 10;

export function DocumentPaper({ docType, state, setState, paperStyle, paperSize }: Props) {
  const isTax = docType === "tax";
  const isChallan = docType === "dc";
  const isQuotation = docType === "quotation";
  const showAmounts = !isChallan;
  const subtotal = state.items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
  const taxAmount = showAmounts ? subtotal * ((state.taxRate || 0) / 100) : 0;
  const total = subtotal + taxAmount;

  const set = <K extends keyof DocState>(key: K, value: DocState[K]) => setState((current) => ({ ...current, [key]: value }));
  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  const addItem = () => {
    if (state.items.length >= MAX_ITEMS) {
      toast.error("Maximum capacity reached for a single A4 page (10 items max).");
      return;
    }
    setState((current) => ({
      ...current,
      items: [...current.items, { id: uid(), description: "", unit: "pcs", qty: 1, rate: 0 }],
    }));
  };
  const removeItem = (id: string) => setState((current) => ({
    ...current,
    items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
  }));

  return (
    <article id="document-paper" className={`paper paper-${paperSize.toLowerCase()}`} style={paperStyle}>
      <div className="top-accent" />
      <div className="document-content">
        <header className="document-header">
          <img src={logoAsset.url} alt="8 Ways Communications" className="document-logo" />
        </header>

        <section className="identity-grid">
          <div className="bill-to">
            <h2>Bill To</h2>
            <TextField value={state.client.name} onChange={(value) => set("client", { ...state.client, name: value })} placeholder="Client name" ariaLabel="Client name" className="client-name" />
            <ContactRow icon={Phone}><TextField value={state.client.phone} onChange={(value) => set("client", { ...state.client, phone: value })} placeholder="Phone number" ariaLabel="Client phone" /></ContactRow>
            <ContactRow icon={Mail}><TextField value={state.client.email} onChange={(value) => set("client", { ...state.client, email: value })} placeholder="Email address" ariaLabel="Client email" /></ContactRow>
            <ContactRow icon={MapPin}><AreaField value={state.client.address} onChange={(value) => set("client", { ...state.client, address: value })} placeholder="Client address" ariaLabel="Client address" /></ContactRow>
            <ContactRow icon={Globe2}><TextField value={state.client.website} onChange={(value) => set("client", { ...state.client, website: value })} placeholder="Website" ariaLabel="Client website" /></ContactRow>
          </div>

          <div className="document-meta">
            <MetaRow label={isTax ? "STI #" : isQuotation ? "Quotation #" : isChallan ? "Challan #" : "Invoice #"}>
              <TextField value={state.meta.number} onChange={(value) => set("meta", { ...state.meta, number: value })} placeholder="#351-34" ariaLabel="Document number" align="right" />
            </MetaRow>
            <MetaRow label="Document Date"><TextField value={state.meta.date} onChange={(value) => set("meta", { ...state.meta, date: value })} placeholder="DD/MM/YYYY" ariaLabel="Document date" align="right" /></MetaRow>
            {!isChallan && <MetaRow label={isQuotation ? "Valid Until" : "Due Date"}><TextField value={isQuotation ? state.meta.validUntil : state.meta.dueDate} onChange={(value) => set("meta", { ...state.meta, [isQuotation ? "validUntil" : "dueDate"]: value })} placeholder="DD/MM/YYYY" ariaLabel={isQuotation ? "Valid until" : "Due date"} align="right" /></MetaRow>}
            {(isTax || isChallan) && <MetaRow label="P.O. No."><TextField value={state.meta.poNumber} onChange={(value) => set("meta", { ...state.meta, poNumber: value })} placeholder="—" ariaLabel="Purchase order number" align="right" /></MetaRow>}
            <h1 className={`document-title document-title-${docType}`}>{DOC_LABELS[docType]}</h1>
          </div>
        </section>

        {isTax && (
          <section className="detail-strip two-columns">
            <InlineDetail label="NTN" value={state.meta.ntn} onChange={(value) => set("meta", { ...state.meta, ntn: value })} />
            <InlineDetail label="STRN" value={state.meta.strn} onChange={(value) => set("meta", { ...state.meta, strn: value })} />
          </section>
        )}
        {isChallan && (
          <section className="detail-strip three-columns">
            <InlineDetail label="Dispatch Via" value={state.dispatch.method} onChange={(value) => set("dispatch", { ...state.dispatch, method: value })} />
            <InlineDetail label="Vehicle No." value={state.dispatch.vehicleNo} onChange={(value) => set("dispatch", { ...state.dispatch, vehicleNo: value })} />
            <InlineDetail label="Gate Pass No." value={state.dispatch.gatePassNo} onChange={(value) => set("dispatch", { ...state.dispatch, gatePassNo: value })} />
          </section>
        )}

        <section className="items-section">
          <table>
            <thead><tr>
              <th className="number-col">No</th><th>Description</th><th className="unit-col">Unit</th><th className="qty-col">Qty</th>
              {showAmounts && <th className="money-col">Unit Price</th>}{showAmounts && <th className="money-col">Amount</th>}
              <th className="no-print action-col" aria-hidden="true" />
            </tr></thead>
            <tbody>
              {state.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="number-col">{index + 1}</td>
                  <td><AreaField value={item.description} onChange={(value) => updateItem(item.id, { description: value })} placeholder="Item or service description" ariaLabel={`Description for row ${index + 1}`} /></td>
                  <td><TextField value={item.unit} onChange={(value) => updateItem(item.id, { unit: value })} placeholder="pcs" ariaLabel={`Unit for row ${index + 1}`} align="center" /></td>
                  <td><NumberField value={item.qty} onChange={(value) => updateItem(item.id, { qty: value })} ariaLabel={`Quantity for row ${index + 1}`} /></td>
                  {showAmounts && <td className="unit-price"><NumberField value={item.rate} onChange={(value) => updateItem(item.id, { rate: value })} ariaLabel={`Unit price for row ${index + 1}`} step={0.01} /></td>}
                  {showAmounts && <td className="line-total">{money((item.qty || 0) * (item.rate || 0), state.currency)}</td>}
                  <td className="no-print action-col"><Button type="button" size="icon" variant="danger" onClick={() => removeItem(item.id)} aria-label={`Remove row ${index + 1}`} title="Remove line"><Trash2 size={15} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" variant="ghost" className="no-print add-line" onClick={addItem}><Plus size={15} /> Add line item</Button>
        </section>

        {showAmounts && (
          <section className="totals">
            <div className="total-row"><span>Sub Total</span><strong>{money(subtotal, state.currency)}</strong></div>
            <div className="total-row">
              <span>{isTax ? "Sales Tax" : "Taxes"}<span className="tax-editor"> (<NumberField value={state.taxRate} onChange={(value) => set("taxRate", value)} ariaLabel="Tax rate percent" />%)</span></span>
              <strong>{money(taxAmount, state.currency)}</strong>
            </div>
            <div className="total-banner"><span>{isQuotation ? "Estimate" : "Total"}</span><strong>{money(total, state.currency)}</strong></div>
          </section>
        )}

        <section className="closing-content">
          <div className="terms-block">
            <h3>Terms &amp; Conditions</h3>
            <AreaField value={state.terms} onChange={(value) => set("terms", value)} placeholder="Payment terms" ariaLabel="Terms and conditions" />
          </div>
          <div className="payment-info">
            <div className="payment-details">
              <strong>Payment Info</strong>
              <AreaField value={state.paymentInfo} onChange={(value) => set("paymentInfo", value)} placeholder="Bank, account, or payment instructions" ariaLabel="Payment information" />
            </div>
            <div className="signature-block">
              <span>Authorized Signature</span>
            </div>
          </div>
          <div className="thank-you"><span>{isChallan ? "Received in Good Order" : "Thanks for your Business!"}</span></div>
        </section>
      </div>

      <footer className="document-footer">
        <FooterField icon={MapPin}><AreaField value={state.footer.address} onChange={(value) => set("footer", { ...state.footer, address: value })} placeholder="Business address" ariaLabel="Business address" /></FooterField>
        <FooterField icon={Phone}><TextField value={state.footer.phone} onChange={(value) => set("footer", { ...state.footer, phone: value })} placeholder="Phone" ariaLabel="Business phone" /></FooterField>
        <FooterField icon={Mail}><TextField value={state.footer.email} onChange={(value) => set("footer", { ...state.footer, email: value })} placeholder="Email" ariaLabel="Business email" /></FooterField>
      </footer>
    </article>
  );
}

function ContactRow({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return <div className="contact-row"><Icon size={14} strokeWidth={2.4} />{children}</div>;
}
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="meta-row"><span>{label}</span><div>{children}</div></div>;
}
function InlineDetail({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><strong>{label}</strong><TextField value={value} onChange={onChange} placeholder="—" ariaLabel={label} /></div>;
}
function FooterField({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return <div className="footer-field"><Icon size={18} />{children}</div>;
}