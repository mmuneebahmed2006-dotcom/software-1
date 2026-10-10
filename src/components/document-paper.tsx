import { memo, useMemo, useState, useEffect, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Globe2, Mail, MapPin, Phone, Plus, Trash2, RotateCcw } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";
import { DOC_LABELS, PAPER_SIZES, money, uid, type DocState, type DocType, type LineItem, type PaperSizeKey } from "@/lib/document";
import { Button } from "@/components/ui/button";
import { AreaField, NumberField, TermsField, TextField } from "@/components/field";

interface Props {
  docType: DocType;
  state: DocState;
  setState: Dispatch<SetStateAction<DocState>>;
  paperStyle: CSSProperties;
  paperSize: PaperSizeKey;
}

// A4: pehle page par 12 rows, uske baad har page par 20 rows
const A4_FIRST_PAGE_ROWS = 12;
const A4_NEXT_PAGE_ROWS = 20;

const numericTextSize = (length: number) => {
  const px = Math.max(7, Math.min(11, (11 * 12) / Math.max(12, length)));
  return `calc(${px}px * var(--paper-scale, 1))`;
};

const numericFieldStyle = (value: number): CSSProperties => {
  const length = Number.isFinite(value) ? String(value).length : 1;
  return {
    boxSizing: "border-box",
    width: `${Math.max(3, length + 1)}ch`,
    maxWidth: "100%",
    marginInline: "auto",
    textAlign: "center",
    fontSize: numericTextSize(length),
  };
};

export const DocumentPaper = memo(function DocumentPaper({ docType, state, setState, paperStyle, paperSize }: Props) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const baseRows = PAPER_SIZES[paperSize].rows || 15;
  const isA4 = String(paperSize).toLowerCase() === "a4";
  const firstRows = isA4 ? A4_FIRST_PAGE_ROWS : baseRows;
  const nextRows = isA4 ? A4_NEXT_PAGE_ROWS : baseRows;

  // Build pages from the user's manual page breaks first, then apply the normal
  // A4 capacity (12 on page 1, 20 on continuation pages).
  const pageStarts = useMemo(() => {
    const starts: number[] = [0];
    const manualBreaks = (state.pageBreaks ?? [])
      .filter((n) => Number.isInteger(n) && n > 0 && n < state.items.length)
      .sort((a, b) => a - b);

    let start = 0;
    let pageIndex = 0;
    let breakCursor = 0;

    while (start < state.items.length) {
      const capacity = pageIndex === 0 ? firstRows : nextRows;
      const capacityEnd = start + capacity;
      while (breakCursor < manualBreaks.length && manualBreaks[breakCursor] <= start) breakCursor++;

      const manualEnd = manualBreaks[breakCursor] ?? Infinity;
      const end = Math.min(capacityEnd, manualEnd);

      if (end <= start) {
        breakCursor++;
        continue;
      }

      if (end < state.items.length) {
        starts.push(end);
      }
      start = end;
      pageIndex++;
    }

    return starts;
  }, [firstRows, nextRows, state.items.length, state.pageBreaks]);

  const pages = useMemo(() => {
    const chunks = pageStarts.map((start, index) => {
      const end = pageStarts[index + 1] ?? state.items.length;
      return state.items.slice(start, end);
    });
    if (chunks.length === 0) chunks.push([]);
    while (chunks.length < state.minimumPages) chunks.push([]);
    return chunks;
  }, [pageStarts, state.items, state.minimumPages]);

  const pageStart = (page: number) => pageStarts[page] ?? state.items.length;

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
    setState((current) => {
      if (current.items.length <= 1) return current;
      const removedIndex = current.items.findIndex((item) => item.id === id);
      if (removedIndex < 0) return current;

      const updatedBreaks = (current.pageBreaks ?? [])
        .filter((breakIndex) => Number.isInteger(breakIndex) && breakIndex > 0)
        .map((breakIndex) => (removedIndex < breakIndex ? breakIndex - 1 : breakIndex));

      return {
        ...current,
        items: current.items.filter((item) => item.id !== id),
        pageBreaks: updatedBreaks,
      };
    });

  const addItemToPage = (pageIndex: number): string => {
    const newId = uid();
    setState((current) => {
      const manualBreaks = (current.pageBreaks ?? [])
        .filter((n) => Number.isInteger(n) && n > 0 && n < current.items.length)
        .sort((a, b) => a - b);

      const starts: number[] = [0];
      let start = 0;
      let page = 0;
      let breakCursor = 0;

      while (start < current.items.length) {
        const capacity = page === 0 ? (isA4 ? A4_FIRST_PAGE_ROWS : baseRows) : (isA4 ? A4_NEXT_PAGE_ROWS : baseRows);
        const capacityEnd = start + capacity;
        while (breakCursor < manualBreaks.length && manualBreaks[breakCursor] <= start) breakCursor++;
        const manualEnd = manualBreaks[breakCursor] ?? Infinity;
        const end = Math.min(capacityEnd, manualEnd);
        if (end <= start) break;
        if (end < current.items.length) starts.push(end);
        start = end;
        page++;
      }

      while (starts.length < current.minimumPages) {
        starts.push(current.items.length);
      }

      const insertAt = starts[pageIndex] !== undefined
        ? Math.min(
            pageIndex + 1 < starts.length ? starts[pageIndex + 1] : current.items.length,
            starts[pageIndex] + (pageIndex === 0 ? (isA4 ? A4_FIRST_PAGE_ROWS : baseRows) : (isA4 ? A4_NEXT_PAGE_ROWS : baseRows))
          )
        : current.items.length;

      const updatedItems = [...current.items];
      updatedItems.splice(insertAt, 0, { id: newId, description: "", unit: "pcs", qty: 1, rate: 0 });

      // Any manual break at or after the insertion point moves one row down.
      const updatedBreaks = manualBreaks
        .map((breakIndex) => (breakIndex >= insertAt ? breakIndex + 1 : breakIndex));

      // If this page was explicitly empty (a manual/minimum page), create its break
      // at the new item position so the new row stays on this page.
      if (pageIndex > 0 && starts[pageIndex] === current.items.length && !updatedBreaks.includes(insertAt)) {
        updatedBreaks.push(insertAt);
      }

      updatedBreaks.sort((a, b) => a - b);

      return {
        ...current,
        items: updatedItems,
        pageBreaks: updatedBreaks,
      };
    });
    return newId;
  };
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

  return (
    <div className="document-paper-wrapper" style={{ position: "relative", width: "100%" }}>
      {/* Floating Toolbar */}
      <div
        className="no-print document-floating-toolbar"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "#fff",
          color: "var(--foreground)",
          padding: "8px 16px",
          borderRadius: "40px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
          border: "1px solid var(--border)"
        }}
      >
        <select
          value={currentPage}
          onChange={(e) => jumpToPage(Number(e.target.value))}
          style={{
            background: "#fff",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
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

        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border)" }} />

        <div
          className="document-zoom-slider"
          role="slider"
          tabIndex={0}
          aria-label="Preview zoom"
          aria-valuemin={40}
          aria-valuemax={160}
          aria-valuenow={zoom}
          aria-valuetext={`${zoom}%`}
          title="Adjust preview zoom"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const bounds = event.currentTarget.getBoundingClientRect();
            handleZoom(40 + Math.round(((event.clientX - bounds.left) / bounds.width) * 120));
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            handleZoom(40 + Math.round(((event.clientX - bounds.left) / bounds.width) * 120));
          }}
          onKeyDown={(event) => {
            const changes: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
            if (event.key === "Home") { event.preventDefault(); handleZoom(40); return; }
            if (event.key === "End") { event.preventDefault(); handleZoom(160); return; }
            const change = changes[event.key];
            if (change !== undefined) { event.preventDefault(); handleZoom(zoom + change); }
          }}
        >
          <span className="document-zoom-slider-track" aria-hidden="true" />
          <span
            className="document-zoom-slider-thumb"
            aria-hidden="true"
            style={{ left: `${((zoom - 40) / 120) * 100}%` }}
          />
        </div>

        <span className="document-zoom-value" aria-live="polite">{zoom}%</span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(100)}
          style={{ color: "var(--foreground)", height: "30px", width: "30px" }}
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
            itemOffset={pageStart(pageIndex)}
            pageIndex={pageIndex}
            pageCount={pages.length}
            paperStyle={paperStyle}
            paperSize={paperSize}
            updateItem={updateItem}
            removeItem={removeItem}
            addItemToPage={addItemToPage}
          />
        ))}
      </div>
    </div>
  );
});

interface PageProps extends Props {
  items: LineItem[];
  itemOffset: number;
  pageIndex: number;
  pageCount: number;
  updateItem: (id: string, patch: Partial<LineItem>) => void;
  removeItem: (id: string) => void;
  addItemToPage: (pageIndex: number) => string;
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
  addItemToPage,
}: PageProps) {
  const isFirstPage = pageIndex === 0;
  const isTax = docType === "tax";
  const isChallan = docType === "dc";
  const isQuotation = docType === "quotation";
  const showAmounts = !isChallan;

  // Calculate totals from THIS PAGE'S line items only.
  // Page 1 = max 12 rows; every continuation page = max 20 rows.
  const subtotal = items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
  const taxAmount = showAmounts ? subtotal * ((state.taxRate || 0) / 100) : 0;
  const total = subtotal + taxAmount;

  const set = <K extends keyof DocState>(key: K, value: DocState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  return (
    <article
      id={`paper-page-${pageIndex + 1}`}
      data-page-num={pageIndex + 1}
      className={`paper paper-${paperSize.toLowerCase()}`}
      style={{ ...paperStyle, position: "relative" }}
      data-pdf-page
    >
      <div className="top-accent" />
      <div className="document-content" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", flex: "1 1 auto", minHeight: 0, height: "auto", paddingBottom: "10px" }}>
        
        <div>
          {(
            <>
                        {/* Header & Logo - Bada Logo */}
                        <header className="document-header" style={{ marginBottom: "2px" }}>
                          <img src={logoMark} alt="Logo" className="document-logo" style={{ maxHeight: "68px" }} />
                        </header>
              
                        {/* Identity Grid */}
                        <section className="identity-grid" style={{ marginBottom: "2px", gap: "8px" }}>
                          <div className="bill-to">
                            {/* BILL TO - Bada */}
                            <h2 style={{ fontSize: "24px", fontWeight: 400, marginBottom: "2px" }}>BILL TO</h2>
                            {/* Client details */}
                            <TextField
                              value={state.client.name}
                              onChange={(value) => set("client", { ...state.client, name: value })}
                              placeholder="Client name"
                              ariaLabel="Client name"
                              className="client-name"
                              style={{ fontSize: "10px" }}
                            />
                            <ContactRow icon={Phone}>
                              <TextField
                                value={state.client.phone}
                                onChange={(value) => set("client", { ...state.client, phone: value })}
                                placeholder="Phone number"
                                ariaLabel="Client phone"
                                style={{ fontSize: "9px" }}
                              />
                            </ContactRow>
                            <ContactRow icon={Mail}>
                              <TextField
                                value={state.client.email}
                                onChange={(value) => set("client", { ...state.client, email: value })}
                                placeholder="Email address"
                                ariaLabel="Client email"
                                style={{ fontSize: "9px" }}
                              />
                            </ContactRow>
                            <ContactRow icon={MapPin}>
                              <AreaField
                                value={state.client.address}
                                onChange={(value) => set("client", { ...state.client, address: value })}
                                placeholder="Client address"
                                ariaLabel="Client address"
                                style={{ fontSize: "9px" }}
                              />
                            </ContactRow>
                            <ContactRow icon={Globe2}>
                              <TextField
                                value={state.client.website}
                                onChange={(value) => set("client", { ...state.client, website: value })}
                                placeholder="Website"
                                ariaLabel="Client website"
                                style={{ fontSize: "9px" }}
                              />
                            </ContactRow>
                          </div>
              
                          <div className="document-meta">
                            {/* Invoice details */}
                            <div className="meta-grid" style={{ fontSize: "9px", gap: "1px" }}>
                              <MetaRow label={isTax ? "STI #" : isQuotation ? "Quotation #" : isChallan ? "Challan #" : "Invoice #"}>
                                <TextField
                                  value={state.meta.number}
                                  onChange={(value) => set("meta", { ...state.meta, number: value })}
                                  placeholder="#351-34"
                                  ariaLabel="Document number"
                                  align="right"
                                  style={{ fontSize: "9px" }}
                                />
                              </MetaRow>
                              <MetaRow label="Document Date">
                                <TextField
                                  value={state.meta.date}
                                  onChange={(value) => set("meta", { ...state.meta, date: value })}
                                  placeholder="DD/MM/YYYY"
                                  ariaLabel="Document date"
                                  align="right"
                                  style={{ fontSize: "9px" }}
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
                                    style={{ fontSize: "9px" }}
                                  />
                                </MetaRow>
                              )}
                            </div>
                            {/* INVOICE Title - Bada */}
                            <h1 className={`document-title document-title-${docType}`} style={{ fontSize: "36px", fontWeight: 400, marginTop: "2px" }}>
                              {DOC_LABELS[docType]}
                            </h1>
                          </div>
                        </section>
              
              
            </>
          )}

          {/* Items Table */}
          <section className="items-section" style={{ marginBottom: "2px" }}>
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
                    <tr key={item.id} className="line-item-row" style={{ height: "18px" }}>
                      <td className="number-col">
                        {item.id === items[items.length - 1]?.id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="row-add-line no-print"
                            onClick={() => addItemToPage(pageIndex)}
                            aria-label={"Add line after row " + (itemOffset + index + 1)}
                            title="Add line after this row"
                          >
                            <Plus size={14} />
                          </Button>
                        )}
                        {itemOffset + index + 1}
                      </td>
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
                      <td className="qty-col" style={{ textAlign: "center", justifyContent: "center" }}>
                        <div className="numeric-cell-center">
                          <NumberField value={item.qty} onChange={(value) => updateItem(item.id, { qty: value })} ariaLabel="Quantity" className="qty-input-field" style={numericFieldStyle(item.qty)} />
                        </div>
                      </td>
                      {showAmounts && (
                        <td className="unit-price-col unit-price" style={{ textAlign: "center", justifyContent: "center" }}>
                          <div className="numeric-cell-center">
                            <NumberField value={item.rate} onChange={(value) => updateItem(item.id, { rate: value })} ariaLabel="Unit price" className="unit-price-input-field" step={0.01} style={numericFieldStyle(item.rate)} />
                          </div>
                        </td>
                      )}
                      {showAmounts && <td className="amount-col line-total" style={{ fontSize: numericTextSize(money((item.qty || 0) * (item.rate || 0), state.currency).length), textAlign: "center" }}>{money((item.qty || 0) * (item.rate || 0), state.currency)}</td>}
                      <td className="no-print action-col">
                        <Button type="button" size="icon" variant="danger" onClick={() => removeItem(item.id)} aria-label="Remove row">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-continuation-row">
                    <td colSpan={showAmounts ? 7 : 5} style={{ textAlign: "center", padding: "10px", color: "#94a3b8", position: "relative" }}>
                      {(
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="row-add-line no-print"
                          onClick={() => addItemToPage(pageIndex)}
                          aria-label={"Add line to page " + (pageIndex + 1)}
                          title="Add line to this page"
                        >
                          <Plus size={14} />
                        </Button>
                      )}

                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          </section>

          {/* Totals */}
          {showAmounts && (
            <section className="totals" style={{ marginBottom: "2px" }}>
              <div className="total-row">
                <span>Sub Total</span>
                <strong>{money(subtotal, state.currency)}</strong>
              </div>
              <div className="total-row">
                <span>
                  {isTax ? "Sales Tax" : "Taxes"}
                  <span className="tax-editor">
                    {" "}<span>(</span><NumberField
                      value={state.taxRate}
                      onChange={(value) => set("taxRate", value)}
                      ariaLabel="Tax rate percent"
                      className="tax-rate-input tax-rate-editor-input" style={{ width: "auto", minWidth: "1ch", textAlign: "center", padding: 0, fieldSizing: "content" }}
                    /><span className="tax-rate-export-value">{Number.isFinite(state.taxRate) ? state.taxRate : 0}</span><span>%</span><span>)</span>
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
        </div>

        {/* Closing Content */}
        {isFirstPage && (
          <section className="closing-content" style={{ marginTop: "auto", paddingTop: "4px" }}>
            <div className="terms-block">
              <h3>Terms &amp; Conditions</h3>
              <TermsField value={state.terms} onChange={(value) => set("terms", value)} placeholder="Payment terms" ariaLabel="Terms and conditions" />
              <div className="terms-full" aria-hidden />
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

      {/* Footer */}
      {isFirstPage && (
        <footer className="document-footer" style={{ flexShrink: 0 }}>
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
                height: `${Math.min(3, (state.footer.address.match(/\n/g)?.length ?? 0) + 1) * 1.3}em`,
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
                whiteSpace: "pre-wrap",
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
