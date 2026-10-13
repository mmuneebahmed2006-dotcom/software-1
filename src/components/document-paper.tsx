import { memo, useMemo, useState, useEffect, useLayoutEffect, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Globe2, Mail, MapPin, Phone, Plus, Trash2, RotateCcw } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";
import { DOC_LABELS, PAPER_SIZES, money, uid, type DocState, type DocType, type LineItem, type PaperSizeKey } from "@/lib/document";
import { Button } from "@/components/ui/button";
import { AreaField, AutoGrowTextField, NumberField, TermsField, TextField } from "@/components/field";

interface Props {
  docType: DocType;
  state: DocState;
  setState: Dispatch<SetStateAction<DocState>>;
  paperStyle: CSSProperties;
  paperSize: PaperSizeKey;
}

interface PaginationMeasurements {
  rowHeights: Record<string, number>;
  baselineRowHeight: number;
  firstPageAvailableHeight: number;
  continuationAvailableHeight: number;
  signature: string;
}

function cssPixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pageZoom(page: HTMLElement) {
  const container = page.closest<HTMLElement>("#document-pages");
  return Math.max(0.1, cssPixels(container?.style.zoom || "1") || 1);
}

/** Measure an ordinary one-line row using the real table, columns, and styles. */
function measureBaselineRowHeight(page: HTMLElement) {
  const sourceRow = page.querySelector<HTMLTableRowElement>("tr.line-item-row");
  if (!sourceRow) return 28 * pageZoom(page);

  const samplePage = page.cloneNode(true) as HTMLElement;
  samplePage.style.position = "fixed";
  samplePage.style.left = "-100000px";
  samplePage.style.top = "0";
  samplePage.style.margin = "0";
  samplePage.style.visibility = "hidden";
  samplePage.style.pointerEvents = "none";
  samplePage.style.boxShadow = "none";
  samplePage.style.overflow = "visible";
  samplePage.style.zoom = String(pageZoom(page));

  const rows = Array.from(samplePage.querySelectorAll<HTMLTableRowElement>("tr.line-item-row"));
  const sampleRow = rows[0];
  rows.slice(1).forEach((row) => row.remove());
  if (!sampleRow) return 28 * pageZoom(page);

  sampleRow.querySelectorAll("button").forEach((button) => button.remove());
  sampleRow.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    input.value = "1";
  });
  sampleRow.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((textarea) => {
    textarea.value = "M";
    textarea.rows = 1;
    textarea.style.setProperty("height", "auto", "important");
    textarea.style.setProperty("min-height", "0", "important");
    textarea.style.setProperty("max-height", "none", "important");
  });

  document.body.appendChild(samplePage);
  const measured = sampleRow.getBoundingClientRect().height;
  samplePage.remove();
  return Math.max(1, measured);
}

function measureAvailableRowHeight(page: HTMLElement, reserveFirstPageContent: boolean) {
  const paper = page.getBoundingClientRect();
  const tableHead = page.querySelector("table thead")?.getBoundingClientRect();
  const content = page.querySelector<HTMLElement>(".document-content");
  if (!tableHead || !content) return 0;

  const zoom = pageZoom(page);
  const pageStyle = getComputedStyle(page);
  const contentStyle = getComputedStyle(content);
  let bottom = paper.bottom - cssPixels(pageStyle.borderBottomWidth) * zoom;

  if (reserveFirstPageContent) {
    const footer = page.querySelector<HTMLElement>(".document-footer");
    const closing = page.querySelector<HTMLElement>(".closing-content");
    if (footer) bottom = footer.getBoundingClientRect().top;
    if (closing) bottom -= closing.getBoundingClientRect().height;
  }

  bottom -= cssPixels(contentStyle.paddingBottom) * zoom;

  const totals = page.querySelector<HTMLElement>(".totals");
  if (totals) {
    const totalsStyle = getComputedStyle(totals);
    bottom -= totals.getBoundingClientRect().height;
    bottom -= (cssPixels(totalsStyle.marginTop) + cssPixels(totalsStyle.marginBottom)) * zoom;
  }
  const itemsSection = page.querySelector<HTMLElement>(".items-section");
  if (itemsSection) bottom -= cssPixels(getComputedStyle(itemsSection).marginBottom) * zoom;

  // Keep a small safety pixel for table borders and fractional device scaling.
  return Math.max(0, bottom - tableHead.bottom - 1);
}

function measurePagination(pageItems: LineItem[]) {
  const pageElements = Array.from(document.querySelectorAll<HTMLElement>("#document-pages [data-pdf-page]"));
  const firstPage = pageElements[0];
  if (!firstPage) return null;

  const rowHeights: Record<string, number> = {};
  for (const page of pageElements) {
    page.querySelectorAll<HTMLTableRowElement>("tr.line-item-row[data-item-id]").forEach((row) => {
      const id = row.dataset.itemId;
      if (id) rowHeights[id] = row.getBoundingClientRect().height;
    });
  }

  const baselineRowHeight = measureBaselineRowHeight(firstPage);
  const firstPageAvailableHeight = measureAvailableRowHeight(firstPage, true);
  const continuationPage = pageElements[1] ?? firstPage;
  const continuationAvailableHeight = measureAvailableRowHeight(continuationPage, false);
  const signature = JSON.stringify({
    rows: pageItems.map((item) => [item.id, Math.round((rowHeights[item.id] ?? baselineRowHeight) * 10) / 10]),
    baseline: Math.round(baselineRowHeight * 10) / 10,
    first: Math.round(firstPageAvailableHeight * 10) / 10,
    continuation: Math.round(continuationAvailableHeight * 10) / 10,
  });

  return { rowHeights, baselineRowHeight, firstPageAvailableHeight, continuationAvailableHeight, signature };
}

function rowLimitForPage(pageIndex: number, paperSize: PaperSizeKey) {
  if (pageIndex === 0) return 12;
  if (pageIndex === 1) return 20;
  return PAPER_SIZES[paperSize].contRows || PAPER_SIZES[paperSize].rows || 20;
}

function paginateRows(
  items: LineItem[],
  paperSize: PaperSizeKey,
  manualBreaks: number[],
  metrics: PaginationMeasurements | null
) {
  const starts = [0];
  if (items.length === 0) return starts;

  const manualBreakSet = new Set(manualBreaks);
  let start = 0;
  let pageIndex = 0;

  while (start < items.length) {
    const baseline = metrics?.baselineRowHeight || 1;
    const maxEquivalentRows = rowLimitForPage(pageIndex, paperSize);
    const maxHeight = pageIndex === 0
      ? metrics?.firstPageAvailableHeight ?? Infinity
      : metrics?.continuationAvailableHeight ?? Infinity;
    let end = start;
    let usedHeight = 0;
    let usedEquivalentRows = 0;

    while (end < items.length) {
      if (end > start && manualBreakSet.has(end)) break;
      const height = Math.max(1, metrics?.rowHeights[items[end].id] ?? baseline);
      const equivalentRows = Math.max(1, Math.ceil(height / baseline - 0.15));
      const exceedsHeight = usedHeight + height > maxHeight + 0.5;
      const exceedsRowLimit = usedEquivalentRows + equivalentRows > maxEquivalentRows + 0.01;

      if (end > start && (exceedsHeight || exceedsRowLimit)) break;

      // An individual row taller than a whole page cannot be split safely.
      // Keep it intact on its own page so pagination always makes progress.
      usedHeight += height;
      usedEquivalentRows += equivalentRows;
      end++;
      if (exceedsHeight || exceedsRowLimit) break;
    }

    if (end <= start) end = start + 1;
    if (end < items.length) starts.push(end);
    start = end;
    pageIndex++;
  }

  return starts;
}

/** Slightly shrinks long numbers so they stay inside the Qty / Unit Price cells. */
function numericFieldStyle(value: number): CSSProperties {
  const length = String(Number.isFinite(value) ? value : 0).length;
  if (length <= 7) return {};
  return { fontSize: `${Math.max(0.72, 1 - (length - 7) * 0.06)}em` };
}

export const DocumentPaper = memo(function DocumentPaper({ docType, state, setState, paperStyle, paperSize }: Props) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMetrics, setPaginationMetrics] = useState<PaginationMeasurements | null>(null);

  // Pack complete rows into each fixed-size page, enforcing both the
  // single-line-equivalent limit and measured printable row area.
  const pageStarts = useMemo(() => {
    const manualBreaks = (state.pageBreaks ?? [])
      .filter((n) => Number.isInteger(n) && n > 0 && n < state.items.length)
      .sort((a, b) => a - b);
    return paginateRows(state.items, paperSize, manualBreaks, paginationMetrics);
  }, [paginationMetrics, paperSize, state.items, state.pageBreaks]);

  const pages = useMemo(() => {
    const chunks = pageStarts.map((start, index) => {
      const end = pageStarts[index + 1] ?? state.items.length;
      return state.items.slice(start, end);
    });
    if (chunks.length === 0) chunks.push([]);
    while (chunks.length < state.minimumPages) chunks.push([]);
    return chunks;
  }, [pageStarts, state.items, state.minimumPages]);

  useLayoutEffect(() => {
    const measured = measurePagination(state.items);
    if (!measured) return;
    setPaginationMetrics((current) => current?.signature === measured.signature ? current : measured);
  }, [docType, pages, paperSize, state.items, zoom]);

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

      const starts = pageStarts.filter((start) => start < current.items.length);
      while (starts.length < current.minimumPages) starts.push(current.items.length);
      const insertAt = pageStarts[pageIndex] !== undefined
        ? (pageStarts[pageIndex + 1] ?? current.items.length)
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
    const clamped = Math.min(Math.max(newZoom, 40), 140);
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
          aria-valuemax={140}
          aria-valuenow={zoom}
          aria-valuetext={`${zoom}%`}
          title="Adjust preview zoom"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const bounds = event.currentTarget.getBoundingClientRect();
            handleZoom(40 + Math.round(((event.clientX - bounds.left) / bounds.width) * 100));
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            handleZoom(40 + Math.round(((event.clientX - bounds.left) / bounds.width) * 100));
          }}
          onKeyDown={(event) => {
            const changes: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
            if (event.key === "Home") { event.preventDefault(); handleZoom(40); return; }
            if (event.key === "End") { event.preventDefault(); handleZoom(140); return; }
            const change = changes[event.key];
            if (change !== undefined) { event.preventDefault(); handleZoom(zoom + change); }
          }}
        >
          <span className="document-zoom-slider-track" aria-hidden="true" />
          <span
            className="document-zoom-slider-thumb"
            aria-hidden="true"
            style={{ left: `${((zoom - 40) / 100) * 100}%` }}
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
          // CSS zoom participates in layout, so auto margins keep the page
          // centered while it fits and the preview gains real scrollable
          // width/height when it grows beyond the viewport.
          display: "block",
          width: "max-content",
          zoom: zoom / 100,
          margin: "0 auto",
          paddingBottom: "100px"
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}
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

  // Running totals: every page's totals include this page's items PLUS every
  // item on the pages before it, so each page's "Total" is the amount due if
  // the document ended there - and the last page always shows the full
  // grand total across every page, not just its own items.
  // Page 1 = max 12 rows; every continuation page = max 20 rows.
  const itemsSoFar = state.items.slice(0, itemOffset + items.length);
  const subtotal = itemsSoFar.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
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
        
        <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
          {(
            <>
                        {/* Header & Logo - Bada Logo */}
                        <header className="document-header" style={{ marginBottom: "2px" }}>
                          <img src={logoMark} alt="Logo" className="document-logo" style={{ maxHeight: "68px" }} />
                        </header>
              
                        {/* Identity Grid */}
                        <section className={`identity-grid${isQuotation ? " quotation-layout" : ""}`} style={{ marginBottom: "2px", gap: "8px" }}>
                          <div className="bill-to">
                            {/* BILL TO - Bada */}
                            <h2 style={{ fontSize: "24px", fontWeight: 400, marginBottom: "2px" }}>BILL TO</h2>
                            {/* Client details */}
                            <AutoGrowTextField
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
                                className="client-email"
                                style={{ fontSize: "9px" }}
                              />
                            </ContactRow>
                            <ContactRow icon={MapPin}>
                              <AutoGrowTextField
                                value={state.client.address}
                                onChange={(value) => set("client", { ...state.client, address: value })}
                                placeholder="Client address"
                                ariaLabel="Client address"
                                style={{ fontSize: "9px", lineHeight: "1.375" }}
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
              
                          <div className={`document-meta${isQuotation ? " quotation-meta" : ""}`}>
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
                    <tr key={item.id} data-item-id={item.id} className="line-item-row" style={{ height: "18px" }}>
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
          <section className="closing-content" style={{ marginTop: "auto", paddingTop: "4px", flex: "0 0 auto" }}>
            <div className="terms-block">
              <h3>Terms &amp; Conditions</h3>
              <TermsField value={state.terms} onChange={(value) => set("terms", value)} placeholder="Payment terms" ariaLabel="Terms and conditions" />
              <div className="terms-full" aria-hidden />
            </div>
            <div className="payment-info">
              <div className="payment-details">
                <strong>Payment Info</strong>
                <AutoGrowTextField
                  value={state.paymentInfo}
                  onChange={(value) => set("paymentInfo", value)}
                  placeholder="Bank, account, or payment instructions"
                  ariaLabel="Payment information"
                  style={{ lineHeight: "1.15" }}
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
