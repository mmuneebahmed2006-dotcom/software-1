import { memo, useMemo, useState, useEffect, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Globe2, Mail, MapPin, Phone, Plus, Trash2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";
import { DOC_LABELS, PAPER_SIZES, money, uid, type DocState, type DocType, type LineItem, type PaperSizeKey } from "@/lib/document";
import { Button } from "@/components/ui/button";
import { AreaField, NumberField, TextField } from "@/components/field";

interface Props {
  docType: DocType;
  state: DocState;
  setState: Dispatch<SetStateAction<DocState>>;
  paperStyle: CSSProperties;
  paperSize: PaperSizeKey;
}

export function DocumentPaper({ docType, state, setState, paperStyle, paperSize }: Props) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const firstPageCapacity = 8; // پہلے صفحے پر بالکل محفوظ 8 لائنیں تاکہ Thanks for your business نہ کٹے
  const laterPageCapacity = PAPER_SIZES[paperSize].rows || 14;

  const pages = useMemo(() => {
    const chunks: LineItem[][] = [];
    if (state.items.length === 0) {
      chunks.push([]);
    } else {
      chunks.push(state.items.slice(0, firstPageCapacity));
      let remainingIndex = firstPageCapacity;
      while (remainingIndex < state.items.length) {
        chunks.push(state.items.slice(remainingIndex, remainingIndex + laterPageCapacity));
        remainingIndex += laterPageCapacity;
      }
    }
    while (chunks.length < state.minimumPages) {
      chunks.push([]);
    }
    return chunks;
  }, [state.items, state.minimumPages, laterPageCapacity]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute("data-page-num"));
            if (pageNum) setCurrentPage(pageNum);
          }
        });
      },
      { threshold: 0.4 }
    );

    pages.forEach((_, idx) => {
      const pageElem = document.getElementById(`paper-page-${idx + 1}`);
      if (pageElem) observer.observe(pageElem);
    });

    return () => observer.disconnect();
  }, [pages]);

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const removeItem = (id: string) =>
    setState((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));

  const addItem = () =>
    setState((current) => ({
      ...current,
      items: [...current.items, { id: uid(), description: "", unit: "pcs", qty: 1, rate: 0 }],
    }));

  const handleZoom = (newZoom: number) => {
    const clamped = Math.min(Math.max(newZoom, 40), 160);
    setZoom(clamped);
  };

  const jumpToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    const pageElem = document.getElementById(`paper-page-${pageNum}`);
    if (pageElem) {
      pageElem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getItemOffset = (pageIdx: number) => {
    if (pageIdx === 0) return 0;
    let offset = firstPageCapacity;
    for (let i = 1; i < pageIdx; i++) {
      offset += laterPageCapacity;
    }
    return offset;
  };

  return (
    <div className="document-paper-wrapper" style={{ position: "relative", width: "100%" }}>
      {/* Floating Toolbar */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "#0f172a",
          color: "#ffffff",
          padding: "8px 16px",
          borderRadius: "40px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          border: "1px solid #334155"
        }}
      >
        <select
          value={currentPage}
          onChange={(e) => jumpToPage(Number(e.target.value))}
          style={{
            background: "#1e293b",
            color: "#ffffff",
            border: "1px solid #475569",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "13px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          {pages.map((_, idx) => (
            <option key={idx + 1} value={idx + 1}>
              Page {idx + 1} of {pages.length}
            </option>
          ))}
        </select>

        <div style={{ width: "1px", height: "18px", backgroundColor: "#475569" }} />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(zoom - 10)}
          style={{ color: "#fff", height: "30px", width: "30px" }}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </Button>

        <span style={{ fontSize: "13px", fontWeight: "bold", minWidth: "45px", textAlign: "center" }}>
          {zoom}%
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(zoom + 10)}
          style={{ color: "#fff", height: "30px", width: "30px" }}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(100)}
          style={{ color: "#fff", height: "30px", width: "30px" }}
          title="Reset Zoom"
        >
          <RotateCcw size={14} />
        </Button>
      </div>

      {/* Pages Container */}
      <div
        id="document-pages"
        className="document-pages"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top center",
          transition: "transform 0.15s ease-out",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "32px",
          paddingBottom: "100px"
        }}
      >
        {pages.map((items, pageIndex) => (
          <DocumentPage
            key={`paper-page-key-${pageIndex}`}
            docType={docType}
            state={state}
            setState={setState}
            items={items}
            itemOffset={getItemOffset(pageIndex)}
            pageIndex={pageIndex}
            pageCount={pages.length}
            paperStyle={paperStyle}
            paperSize={paperSize}
            updateItem={updateItem}
            removeItem={removeItem}
            addItem={addItem}
          />
        ))}
      </div>
    </div>
  );
}

interface PageProps extends Props {
  items: LineItem[];
  itemOffset: number;
  pageIndex: number;
  pageCount: number;
  updateItem: (id: string, patch: Partial<LineItem>) => void;
  removeItem: (id: string) => void;
  addItem: () => void;
}

const DocumentPage = memo(function DocumentPage({
  docType,
  state,
  setState,
  items,
  itemOffset,
  pageIndex,
  pageCount,
  paperStyle,
  paperSize,
  updateItem,
  removeItem,
  addItem,
}: PageProps) {
  const isFirstPage = pageIndex === 0;
  const isTax = docType === "tax";
  const isChallan = docType === "dc";
  const isQuotation = docType === "quotation";
  const showAmounts = !isChallan;

  const subtotal = state.items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
  const taxAmount = showAmounts ? subtotal * ((state.taxRate || 0) / 100) : 0;
  const total = subtotal + taxAmount;

  const set = <K extends keyof DocState>(key: K, value: DocState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  return (
    <article
      id={`paper-page-${pageIndex + 1}`}
      data-page-num={pageIndex + 1}
      className={`paper paper-${paperSize.toLowerCase()}`}
      style={{ ...paperStyle, position: "relative", minHeight: "1056px" }}
      data-pdf-page
    >
      <div className="top-accent" />
      <div className="document-content">
        
        {/* ہیڈر اور لوگو */}
        <header className="document-header">
          <img src={logoMark} alt="8 Ways Communications" className="document-logo" />
        </header>

        <section className="identity-grid">
          <div className="bill-to">
            <h2>Bill To</h2>
            <TextField
              value={state.client.name}
              onChange={(value) => set("client", { ...state.client, name: value })}
              placeholder="Client name"
              ariaLabel="Client name"
              className="client-name"
            />
            <ContactRow icon={Phone}>
              <TextField
                value={state.client.phone}
                onChange={(value) => set("client", { ...state.client, phone: value })}
                placeholder="Phone number"
                ariaLabel="Client phone"
              />
            </ContactRow>
            <ContactRow icon={Mail}>
              <TextField
                value={state.client.email}
                onChange={(value) => set("client", { ...state.client, email: value })}
                placeholder="Email address"
                ariaLabel="Client email"
              />
            </ContactRow>
            <ContactRow icon={MapPin}>
              <AreaField
                value={state.client.address}
                onChange={(value) => set("client", { ...state.client, address: value })}
                placeholder="Client address"
                ariaLabel="Client address"
              />
            </ContactRow>
            <ContactRow icon={Globe2}>
              <TextField
                value={state.client.website}
                onChange={(value) => set("client", { ...state.client, website: value })}
                placeholder="Website"
                ariaLabel="Client website"
              />
            </ContactRow>
          </div>

          <div className="document-meta">
            <div className="meta-grid">
              <MetaRow label={isTax ? "STI #" : isQuotation ? "Quotation #" : isChallan ? "Challan #" : "Invoice #"}>
                <TextField
                  value={state.meta.number}
                  onChange={(value) => set("meta", { ...state.meta, number: value })}
                  placeholder="#351-34"
                  ariaLabel="Document number"
                  align="right"
                />
              </MetaRow>
              <MetaRow label="Document Date">
                <TextField
                  value={state.meta.date}
                  onChange={(value) => set("meta", { ...state.meta, date: value })}
                  placeholder="DD/MM/YYYY"
                  ariaLabel="Document date"
                  align="right"
                />
              </MetaRow>
              {!isChallan && (
                <MetaRow label={isQuotation ? "Valid Until" : "Due Date"}>
                  <TextField
                    value={isQuotation ? state.meta.validUntil : state.meta.dueDate}
                    onChange={(value) =>
                      set("meta", {
                        ...state.meta,
                        [isQuotation ? "validUntil" : "dueDate"]: value,
                      })
                    }
                    placeholder="DD/MM/YYYY"
                    ariaLabel={isQuotation ? "Valid until" : "Due date"}
                    align="right"
                  />
                </MetaRow>
              )}
            </div>
            {/* عنوان اب بالکل صاف ستھرا رہے گا، کوئی سلیش یا پیج کا لفظ نہیں کٹے گا */}
            <h1 className={`document-title document-title-${docType}`}>
              {DOC_LABELS[docType]}
            </h1>
          </div>
        </section>

        {/* آئٹمز ٹیبل */}
        <section className="items-section">
          <table>
            <thead>
              <tr>
                <th className="number-col">No</th>
                <th>Description</th>
                <th className="unit-col">Unit</th>
                <th className="qty-col">Qty</th>
                {showAmounts && <th className="unit-price-col">Unit Price</th>}
                {showAmounts && <th className="amount-col">Amount</th>}
                <th className="no-print action-col" />
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="number-col">{itemOffset + index + 1}</td>
                    <td className="description-col">
                      <AreaField
                        value={item.description}
                        onChange={(value) => updateItem(item.id, { description: value })}
                        placeholder="Item or service description"
                        ariaLabel={`Description for row ${itemOffset + index + 1}`}
                      />
                    </td>
                    <td className="unit-col">
                      <TextField
                        value={item.unit}
                        onChange={(value) => updateItem(item.id, { unit: value })}
                        placeholder="pcs"
                        ariaLabel="Unit"
                        align="center"
                      />
                    </td>
                    <td className="qty-col">
                      <NumberField value={item.qty} onChange={(value) => updateItem(item.id, { qty: value })} ariaLabel="Quantity" />
                    </td>
                    {showAmounts && (
                      <td className="unit-price-col unit-price">
                        <NumberField value={item.rate} onChange={(value) => updateItem(item.id, { rate: value })} ariaLabel="Unit price" step={0.01} />
                      </td>
                    )}
                    {showAmounts && <td className="amount-col line-total">{money((item.qty || 0) * (item.rate || 0), state.currency)}</td>}
                    <td className="no-print action-col">
                      <Button type="button" size="icon" variant="danger" onClick={() => removeItem(item.id)} aria-label="Remove row">
                        <Trash2 size={15} />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={showAmounts ? 7 : 5} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    Continuation Page {pageIndex + 1}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Button type="button" variant="ghost" className="no-print add-line" onClick={addItem}>
            <Plus size={15} /> Add line item
          </Button>
        </section>

        {/* Totals */}
        {showAmounts && (
          <section className="totals">
            <div className="total-row">
              <span>Sub Total</span>
              <strong>{money(subtotal, state.currency)}</strong>
            </div>
            <div className="total-row">
              <span>
                {isTax ? "Sales Tax" : "Taxes"}
                <span className="tax-editor">
                  {" "}
                  (<NumberField value={state.taxRate} onChange={(value) => set("taxRate", value)} ariaLabel="Tax rate percent" />%)
                </span>
              </span>
              <strong>{money(taxAmount, state.currency)}</strong>
            </div>
            <div className="total-banner">
              <span>{isQuotation ? "Estimate" : "Total"}</span>
              <strong>{money(total, state.currency)}</strong>
            </div>
          </section>
        )}

        {/* Terms & Conditions اور Thank You اب بالکل واضح اور صحیح جگہ پر نظر آئیں گے */}
        {isFirstPage && (
          <section className="closing-content">
            <div className="terms-block">
              <h3>Terms &amp; Conditions</h3>
              <AreaField value={state.terms} onChange={(value) => set("terms", value)} placeholder="Payment terms" ariaLabel="Terms and conditions" />
            </div>
            <div className="payment-info">
              <div className="payment-details">
                <strong>Payment Info</strong>
                <AreaField
                  value={state.paymentInfo}
                  onChange={(value) => set("paymentInfo", value)}
                  placeholder="Bank, account, or payment instructions"
                  ariaLabel="Payment information"
                />
              </div>
              <div className="signature-block">Authorized Signature</div>
            </div>
            <div className="thank-you">
              <span>{isChallan ? "Received in Good Order" : "Thanks for your Business!"}</span>
            </div>
          </section>
        )}
      </div>

      {/* Footer صرف فرنٹ پیج پر */}
      {isFirstPage && (
        <footer className="document-footer">
          <div className="footer-field" style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", height: "100%" }}>
            <MapPin size={18} style={{ flexShrink: 0 }} />
            <textarea
              value={state.footer.address}
              onChange={(e) => set("footer", { ...state.footer, address: e.target.value })}
              placeholder="Business address"
              aria-label="Business address"
              rows={1}
              style={{
                width: "100%",
                height: "1.3em",
                minHeight: "1.3em",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: "inherit",
                fontFamily: "inherit",
                fontSize: "inherit",
                lineHeight: "1.3",
                padding: "0",
                margin: "0",
                display: "block",
                overflow: "hidden",
              }}
            />
          </div>
          <FooterFooterField icon={Phone}>
            <TextField value={state.footer.phone} onChange={(value) => set("footer", { ...state.footer, phone: value })} placeholder="Phone" ariaLabel="Business phone" />
          </FooterFooterField>
          <FooterFooterField icon={Mail}>
            <TextField value={state.footer.email} onChange={(value) => set("footer", { ...state.footer, email: value })} placeholder="Email" ariaLabel="Business email" />
          </FooterFooterField>
        </footer>
      )}

      <div className="page-number no-print">
        Page {pageIndex + 1} of {pageCount}
      </div>
    </article>
  );
});

function ContactRow({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return <div className="contact-row"><Icon size={14} />{children}</div>;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="meta-row"><span>{label}</span><div>{children}</div></div>;
}

function FooterFooterField({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return <div className="footer-field" style={{ display: "flex", alignItems: "center" }}><Icon size={18} />{children}</div>;
}
