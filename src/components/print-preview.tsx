import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Printer, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CapturedDocument } from "@/lib/pdf";

export type PrintSettings = {
  gray: boolean;
  printDocument: boolean;
  printComment: boolean;
  printForm: boolean;
  sides: "single" | "double";
  copies: number;
  paperSize: string;
  mode: "size" | "poster" | "multiple" | "booklet";
  sizing: "fit" | "actual" | "custom";
  scale: number;
  autoRotate: boolean;
  autoCenter: boolean;
  orientation: "portrait" | "landscape";
  range: "current" | "view" | "all" | "odd" | "even" | "custom";
  customRange: string;
  printAsImage: boolean;
  dpi: 150 | 300 | 600;
  printerName: string;
  pagesPerSheet: 2 | 4 | 6 | 9 | 16;
  posterScale: number;
  posterOverlap: number;
  posterCutMarks: boolean;
  posterLabels: boolean;
  multiplePageOrder: "horizontal" | "horizontal-reversed" | "vertical" | "vertical-reversed";
  bookletSubset: "both" | "front" | "back";
  bookletFrom: number;
  bookletTo: number;
  bookletBinding: "left" | "right";
  currentPage?: number;
};

type Props = {
  open: boolean;
  captured: CapturedDocument | null;
  paperLabel: string;
  fileName: string;
  onClose: () => void;
  onPrint: (settings: PrintSettings) => void | Promise<void>;
  onPaperSizeChange?: (paperLabel: string) => void | Promise<void>;
};

const PAPER_OPTIONS = [
  ["A4 21 × 29.7 cm", "A4"],
  ["A5 14.8 × 21 cm", "A5"],
  ["Letter 8.5 × 11 in", "Letter"],
  ["Legal 8.5 × 14 in", "Legal"],
] as const;

/** Accept either the display label or the canonical key supplied by the workspace. */
const normalizePaperLabel = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return PAPER_OPTIONS.find(([label, key]) => label === value || key.toLowerCase() === normalized)?.[0]
    ?? PAPER_OPTIONS[0][0];
};

const PAPER_RATIOS: Record<string, number> = {
  "A4 21 × 29.7 cm": 210 / 297,
  "A5 14.8 × 21 cm": 148 / 210,
  "Letter 8.5 × 11 in": 8.5 / 11,
  "Legal 8.5 × 14 in": 8.5 / 14,
};

const gridSpec = (count: number) => {
  if (count === 2) return { columns: 2, rows: 1 };
  if (count === 4) return { columns: 2, rows: 2 };
  if (count === 6) return { columns: 3, rows: 2 };
  if (count === 9) return { columns: 3, rows: 3 };
  return { columns: 4, rows: 4 };
};

function orderedIndices(count: number, order: PrintSettings["multiplePageOrder"]) {
  const { columns, rows } = gridSpec(count);
  return Array.from({ length: count }, (_, index) => {
    if (order === "vertical" || order === "vertical-reversed") {
      const row = index % rows;
      const col = Math.floor(index / rows);
      return (order === "vertical-reversed" ? rows - 1 - row : row) * columns + col;
    }
    const row = Math.floor(index / columns);
    const col = index % columns;
    return row * columns + (order === "horizontal-reversed" ? columns - 1 - col : col);
  });
}

export function PrintPreview({ open, captured, paperLabel, fileName, onClose, onPrint, onPaperSizeChange }: Props) {
  const [settings, setSettings] = useState<PrintSettings>({
    gray: false, printDocument: true, printComment: true, printForm: true,
    sides: "single", copies: 1, paperSize: normalizePaperLabel(paperLabel || "A4"),
    mode: "size", sizing: "fit", scale: 100, autoRotate: true, autoCenter: true,
    orientation: "portrait", range: "all", customRange: "1",
    printAsImage: true, dpi: 300, printerName: "", pagesPerSheet: 2,
    posterScale: 100, posterOverlap: 0, posterCutMarks: false, posterLabels: false,
    multiplePageOrder: "horizontal",
    bookletSubset: "both", bookletFrom: 1, bookletTo: Math.max(1, Math.ceil((captured?.images.length || 1) / 4)),
    bookletBinding: "left",
  });
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; description: string; options: Record<string, string>; status?: "ready" | "offline" | "printing" | "unknown"; isDefault?: boolean }>>([]);
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState(false);
  const images = captured?.images ?? [];
  const total = images.length;
  const image = images[page] ?? images[0];

  const patch = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const setMode = (mode: PrintSettings["mode"]) => setSettings((s) => ({
    ...s,
    mode,
    pagesPerSheet: mode === "multiple" ? 2 : s.pagesPerSheet,
    sides: mode === "booklet" ? "double" : mode === "size" ? "single" : s.sides,
    autoRotate: true,
    autoCenter: true,
  }));

  const loadPrinters = async () => {
    if (!window.desktop?.listPrinters) return;
    try {
      const list = await window.desktop.listPrinters();
      setPrinters(list);
      const preferred = list.find((p) => p.isDefault)?.name ?? list[0]?.name ?? "";
      setSettings((s) => ({ ...s, printerName: s.printerName || preferred }));
    } catch {
      setPrinters([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadPrinters();
  }, [open]);

  useEffect(() => {
    if (captured?.images.length) {
      setPage((p) => Math.min(p, captured.images.length - 1));
      const sheetCount = Math.max(1, Math.ceil(captured.images.length / 4));
      setSettings((s) => {
        const bookletFrom = Math.min(s.bookletFrom, sheetCount);
        return { ...s, bookletFrom, bookletTo: Math.min(sheetCount, Math.max(bookletFrom, s.bookletTo)) };
      });
    }
  }, [captured?.images.length]);

  useEffect(() => {
    if (paperLabel) setSettings((s) => ({ ...s, paperSize: normalizePaperLabel(paperLabel) }));
  }, [paperLabel]);

  const paperRatio = PAPER_RATIOS[settings.paperSize] ?? PAPER_RATIOS["A4 21 × 29.7 cm"];
  const sheetRatio = settings.orientation === "landscape" ? 1 / paperRatio : paperRatio;
  // The preview uses the full paper canvas; the printer may still enforce its hardware margins.
  const printMarginMm = 0;
  const fitSheetMm = ({
    "A4 21 × 29.7 cm": [210, 297],
    "A5 14.8 × 21 cm": [148, 210],
    "Letter 8.5 × 11 in": [215.9, 279.4],
    "Legal 8.5 × 14 in": [215.9, 355.6],
  } as Record<string, [number, number]>)[settings.paperSize] ?? [210, 297];
  const [pageWidthMm, pageHeightMm] = settings.orientation === "landscape"
    ? [fitSheetMm[1], fitSheetMm[0]]
    : fitSheetMm;
  const safeAreaFrameStyle: React.CSSProperties | undefined = settings.mode === "size" ? {
    width: "100%",
    height: "100%",
  } : undefined;
  const previewImageStyle = useMemo<React.CSSProperties>(() => {
    const mm: Record<string, [number, number]> = { "A4 21 × 29.7 cm": [210, 297], "A5 14.8 × 21 cm": [148, 210], "Letter 8.5 × 11 in": [215.9, 279.4], "Legal 8.5 × 14 in": [215.9, 355.6] };
    const [pw, ph] = mm[settings.paperSize] ?? [210, 297];
    const sheetW = settings.orientation === "landscape" ? ph : pw;
    const sheetH = settings.orientation === "landscape" ? pw : ph;
    const [srcW, srcH]: [number, number] = captured?.size ?? [pw, ph];
    const rotate = settings.autoRotate && ((srcW > srcH) !== (sheetW > sheetH));
    const pageW = rotate ? srcH : srcW;
    const pageH = rotate ? srcW : srcH;
    const usableW = sheetW - printMarginMm * 2;
    const usableH = sheetH - printMarginMm * 2;
    const base: React.CSSProperties = { filter: settings.gray ? "grayscale(1)" : "none", flex: "none" };
    if (settings.sizing === "fit") return {
      ...base,
      ["--img-w" as string]: "100%",
      ["--img-h" as string]: "100%",
      objectFit: "contain",
    } as React.CSSProperties;
    const requestedScale = settings.sizing === "custom" ? Math.min(400, Math.max(10, Number(settings.scale) || 100)) / 100 : 1;
    const fitScale = Math.min(usableW / pageW, usableH / pageH);
    const k = settings.sizing === "custom" ? requestedScale : 1;
    return { ...base, ["--img-w" as string]: `${(pageW * k / usableW) * 100}%`, ["--img-h" as string]: `${(pageH * k / usableH) * 100}%`, objectFit: "fill" } as React.CSSProperties;
  }, [captured?.size, settings.gray, settings.orientation, settings.paperSize, settings.scale, settings.sizing]);

  const printerState = useMemo(() => {
    if (!window.desktop) return "System print dialog";
    const selected = printers.find((p) => p.name === settings.printerName);
    if (!selected) return printers.length ? "Offline" : "System print dialog";
    if (selected.status === "offline") return "Offline";
    if (selected.status === "printing") return "Printing…";
    return "Ready to print";
  }, [printers, settings.printerName]);

  const handlePaperChange = async (value: string) => {
    patch("paperSize", value);
    await onPaperSizeChange?.(value);
  };

  const handlePrint = async () => {
    setPrinting(true);
    try { 
      await onPrint({ ...settings, currentPage: page }); 
    } catch (error) {
      console.error("Print error:", error);
    } finally { 
      setPrinting(false); 
    }
  };

  const selectedMultiple = orderedIndices(settings.pagesPerSheet, settings.multiplePageOrder);
  const multipleStart = Math.floor(page / settings.pagesPerSheet) * settings.pagesPerSheet;
  const bookletSheetCount = Math.max(1, Math.ceil(total / 4));
  const bookletSheet = Math.min(bookletSheetCount - 1, Math.max(0, settings.bookletFrom - 1));
  const paddedPageIndices = Array.from({ length: Math.ceil(total / 4) * 4 }, (_, i) => i < total ? i : null);
  let bookletFront = [paddedPageIndices[paddedPageIndices.length - 1 - 2 * bookletSheet] ?? null, paddedPageIndices[2 * bookletSheet] ?? null];
  let bookletBack = [paddedPageIndices[2 * bookletSheet + 1] ?? null, paddedPageIndices[paddedPageIndices.length - 2 - 2 * bookletSheet] ?? null];
  if (settings.bookletBinding === "right") { bookletFront = bookletFront.reverse(); bookletBack = bookletBack.reverse(); }
  const bookletPreviewPages = settings.bookletSubset === "back" ? bookletBack : bookletFront;
  const previewDimensions: Record<string, [number, number]> = {
    "A4 21 × 29.7 cm": [210, 297], "A5 14.8 × 21 cm": [148, 210],
    "Letter 8.5 × 11 in": [215.9, 279.4], "Legal 8.5 × 14 in": [215.9, 355.6],
  };
  const rawPaper = previewDimensions[settings.paperSize] ?? [210, 297];
  const [previewW, previewH] = settings.orientation === "landscape" ? [rawPaper[1], rawPaper[0]] : rawPaper;
  const [sourceW, sourceH] = captured?.size ?? rawPaper;
  const posterRotate = settings.autoRotate && ((sourceW > sourceH) !== (previewW > previewH));
  const posterRawW = sourceW * Math.max(1, settings.posterScale) / 100;
  const posterRawH = sourceH * Math.max(1, settings.posterScale) / 100;
  const posterImageW = posterRotate ? posterRawH : posterRawW;
  const posterImageH = posterRotate ? posterRawW : posterRawH;
  const posterOverlap = Math.max(0, Math.min(50, settings.posterOverlap));
  const posterCols = Math.max(1, Math.ceil(Math.max(0, posterImageW - posterOverlap) / Math.max(1, previewW - posterOverlap)));
  const posterRows = Math.max(1, Math.ceil(Math.max(0, posterImageH - posterOverlap) / Math.max(1, previewH - posterOverlap)));
  const posterOffsetX = settings.autoCenter ? Math.max(0, (posterCols * previewW - (posterCols - 1) * posterOverlap - posterImageW) / 2) : 0;
  const posterOffsetY = settings.autoCenter ? Math.max(0, (posterRows * previewH - (posterRows - 1) * posterOverlap - posterImageH) / 2) : 0;

  if (!open) return null;

  return (
    <div className="print-preview-overlay" role="dialog" aria-modal="true" aria-label="Print preview">
      <div className="print-preview-window print-preview-white print-preview-three-columns">
        <header className="print-preview-titlebar print-preview-light-titlebar">
          <div className="print-title-left"><Printer size={17} /><span>Print</span><small>{fileName}</small></div>
          <button type="button" onClick={onClose} disabled={printing} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="print-preview-body">
          <aside className="print-settings-panel">
            <section className="print-setting-group print-group-printer">
              <div className="print-section-title"><h3>Printer</h3></div>
              <div className="print-printer-row">
                <select aria-label="Printer" value={settings.printerName} onChange={(e) => patch("printerName", e.target.value)}>
                  {printers.length ? printers.map((printer) => <option key={printer.name} value={printer.name}>{printer.displayName || printer.name}</option>) : <option value="">No printer detected</option>}
                </select>
                <button type="button" onClick={() => window.desktop?.openPrinterSettings?.(settings.printerName || undefined)} aria-label="Printer settings" title="Printer properties"><Settings size={16} /></button>
              </div>
              <div className={"print-printer-hint " + (printerState === "Offline" ? "offline" : "")}>{printerState}</div>
            </section>

            <section className="print-setting-group print-group-content">
              <div className="print-section-title"><h3>Print Content</h3></div>
              {([["printDocument","Document"],["printComment","Comment"],["printForm","Form"]] as const).map(([key, label]) => (
                <label className="print-check" key={key}><input type="checkbox" checked={settings[key]} onChange={(e) => patch(key, e.target.checked)} /> {label}</label>
              ))}
              <label className="print-check"><input type="checkbox" checked={settings.gray} onChange={(e) => patch("gray", e.target.checked)} /> Print in grayscale</label>
            </section>

            <section className="print-setting-group print-group-settings">
              <h3>Print Settings</h3>
              <label className="print-select-row"><span>Copies</span><input className="print-number-input" type="number" min={1} max={999} value={settings.copies} onChange={(e) => patch("copies", Math.max(1, Number(e.target.value) || 1))} /></label>
              <label className="print-select-row"><span>Paper</span><select value={settings.paperSize} onChange={(e) => void handlePaperChange(e.target.value)}>{PAPER_OPTIONS.map(([label]) => <option key={label} value={label}>{label}</option>)}</select></label>
              <label className="print-select-row"><span>Print sides</span><select value={settings.sides} onChange={(e) => patch("sides", e.target.value as PrintSettings["sides"])}><option value="single">Single</option><option value="double">Double</option></select></label>
            </section>

            <section className="print-setting-group print-mode-group print-group-mode">
              <h3>Page sizing &amp; handling</h3>
              <div className="print-mode-tabs" role="tablist">
                {([["size","Size"],["poster","Poster"],["multiple","Multiple"],["booklet","Booklet"]] as const).map(([mode,label]) => (
                  <button type="button" role="tab" aria-selected={settings.mode === mode} key={mode} className={settings.mode === mode ? "active" : ""} onClick={() => setMode(mode)}>{label}</button>
                ))}
              </div>

              {settings.mode === "size" && (
                <>
                  <div className="print-card-note">Print each page at the selected paper size.</div>
                  <div className="print-radio-list">
                    <label><input type="radio" checked={settings.sizing === "fit"} onChange={() => patch("sizing","fit")} /> Fit</label>
                    <label><input type="radio" checked={settings.sizing === "actual"} onChange={() => patch("sizing","actual")} /> Actual size</label>
                    <label><input type="radio" checked={settings.sizing === "custom"} onChange={() => patch("sizing","custom")} /> Custom scale <input className="print-scale-input" type="number" min={10} max={200} value={settings.scale} onChange={(e) => patch("scale", Math.max(10, Number(e.target.value) || 100))} />%</label>
                  </div>
                  <label className="print-check"><input type="checkbox" checked={settings.autoRotate} onChange={(e) => patch("autoRotate", e.target.checked)} /> Auto rotate</label>
                  <label className="print-check"><input type="checkbox" checked={settings.autoCenter} onChange={(e) => patch("autoCenter", e.target.checked)} /> Auto center</label>
                </>
              )}

              {settings.mode === "poster" && (
                <div className="print-special-settings">
                  <label className="print-select-row"><span>Tile scale</span><input className="print-number-input" type="number" min={100} max={400} value={settings.posterScale} onChange={(e) => patch("posterScale", Math.max(100, Number(e.target.value) || 100))} />%</label>
                  <label className="print-select-row"><span>Overlap</span><div className="print-unit-input"><input className="print-number-input" type="number" min={0} max={10} step={0.1} value={settings.posterOverlap} onChange={(e) => patch("posterOverlap", Math.max(0, Number(e.target.value) || 0))} /> mm</div></label>
                  <label className="print-check"><input type="checkbox" checked={settings.posterCutMarks} onChange={(e) => patch("posterCutMarks", e.target.checked)} /> Cut marks</label>
                  <label className="print-check"><input type="checkbox" checked={settings.posterLabels} onChange={(e) => patch("posterLabels", e.target.checked)} /> Labels</label>
                  <label className="print-check"><input type="checkbox" checked={settings.autoRotate} onChange={(e) => patch("autoRotate", e.target.checked)} /> Auto rotate</label>
                  <label className="print-check"><input type="checkbox" checked={settings.autoCenter} onChange={(e) => patch("autoCenter", e.target.checked)} /> Auto center</label>
                </div>
              )}

              {settings.mode === "multiple" && (
                <div className="print-special-settings">
                  <label className="print-select-row"><span>Pages per sheet</span><select value={settings.pagesPerSheet} onChange={(e) => patch("pagesPerSheet", Number(e.target.value) as PrintSettings["pagesPerSheet"])}><option value={2}>2</option><option value={4}>4</option><option value={6}>6</option><option value={9}>9</option><option value={16}>16</option></select></label>
                  <label className="print-select-row"><span>Page order</span><select value={settings.multiplePageOrder} onChange={(e) => patch("multiplePageOrder", e.target.value as PrintSettings["multiplePageOrder"])}><option value="horizontal">Left to right</option><option value="horizontal-reversed">Right to left</option><option value="vertical">Top to bottom</option><option value="vertical-reversed">Bottom to top</option></select></label>
                  <label className="print-check"><input type="checkbox" checked={settings.autoRotate} onChange={(e) => patch("autoRotate", e.target.checked)} /> Auto rotate</label>
                  <label className="print-check"><input type="checkbox" checked={settings.autoCenter} onChange={(e) => patch("autoCenter", e.target.checked)} /> Auto center</label>
                </div>
              )}

              {settings.mode === "booklet" && (
                <div className="print-special-settings">
                  <label className="print-select-row"><span>Booklet subset</span><select value={settings.bookletSubset} onChange={(e) => patch("bookletSubset", e.target.value as PrintSettings["bookletSubset"])}><option value="both">Both sides</option><option value="front">Front only</option><option value="back">Back only</option></select></label>
                  <label className="print-select-row"><span>Sheets from</span><div className="print-range-pair"><input type="number" min={1} max={Math.max(1, Math.ceil(total / 4))} value={Math.min(settings.bookletFrom, Math.max(1, Math.ceil(total / 4)))} onChange={(e) => { const next = Math.min(Math.max(1, Math.ceil(total / 4)), Math.max(1, Number(e.target.value) || 1)); setSettings((s) => ({ ...s, bookletFrom: next, bookletTo: Math.max(next, s.bookletTo) })); }} /> to <input type="number" min={1} max={Math.max(1, Math.ceil(total / 4))} value={Math.min(settings.bookletTo, Math.max(1, Math.ceil(total / 4)))} onChange={(e) => { const next = Math.min(Math.max(1, Math.ceil(total / 4)), Math.max(1, Number(e.target.value) || 1)); setSettings((s) => ({ ...s, bookletTo: next, bookletFrom: Math.min(s.bookletFrom, next) })); }} /></div></label>
                  <div className="print-choice-row"><label><input type="radio" checked={settings.bookletBinding === "left"} onChange={() => patch("bookletBinding","left")} /> Left</label><label><input type="radio" checked={settings.bookletBinding === "right"} onChange={() => patch("bookletBinding","right")} /> Right</label></div>
                  <label className="print-check"><input type="checkbox" checked={settings.autoRotate} onChange={(e) => patch("autoRotate", e.target.checked)} /> Auto rotate</label>
                  <label className="print-check"><input type="checkbox" checked={settings.autoCenter} onChange={(e) => patch("autoCenter", e.target.checked)} /> Auto center</label>
                </div>
              )}
            </section>

            <section className="print-setting-group print-group-orientation">
              <h3>Orientation</h3>
              <div className="print-orientation">
                <button type="button" className={settings.orientation === "portrait" ? "active" : ""} onClick={() => patch("orientation","portrait")}><span className="orientation-icon portrait-icon" /></button>
                <button type="button" className={settings.orientation === "landscape" ? "active" : ""} onClick={() => patch("orientation","landscape")}><span className="orientation-icon landscape-icon" /></button>
              </div>
            </section>

            <section className="print-setting-group print-group-range">
              <h3>Page range</h3>
              <label className="print-select-row"><span>Pages</span><select value={settings.range} onChange={(e) => patch("range", e.target.value as PrintSettings["range"])} aria-label="Page range">
                <option value="all">All Pages</option><option value="odd">Odd Pages</option><option value="even">Even Pages</option>
                <option value="current">Current page</option><option value="view">Current view</option><option value="custom">Custom</option>
              </select></label>
              <div className="print-custom-range"><input disabled={settings.range !== "custom"} value={settings.customRange} onChange={(e) => patch("customRange",e.target.value)} placeholder="1-3, 5" /></div>
            </section>

            <section className="print-setting-group print-group-quality">
              <h3>Output quality</h3>
              <label className="print-check"><input type="checkbox" checked={settings.printAsImage} onChange={(e) => patch("printAsImage", e.target.checked)} /> Print as image</label>
              <label className="print-select-row"><span>DPI</span><select value={settings.dpi} disabled={!settings.printAsImage} onChange={(e) => patch("dpi", Number(e.target.value) as PrintSettings["dpi"])}><option value={150}>150 DPI</option><option value={300}>300 DPI</option><option value={600}>600 DPI</option></select></label>
            </section>
          </aside>

          <main className="print-preview-stage print-preview-stage-light">
            <div className="print-preview-toolbar"><span className="print-preview-filename">{fileName}</span><span>{settings.mode === "multiple" ? `${settings.pagesPerSheet} pages / sheet` : settings.mode === "poster" ? "Poster mode" : settings.mode === "booklet" ? "Booklet mode" : "Standard"}</span></div>
            <div className="print-preview-paper-wrap">
              <div className={"print-output-preview mode-" + settings.mode} style={{ aspectRatio: String(sheetRatio), ["--sheet-ratio" as string]: String(sheetRatio) } as React.CSSProperties}>
                {settings.mode === "size" && image && (
                  <div className="print-preview-page-frame" style={{ ...safeAreaFrameStyle, alignItems: settings.sizing === "fit" || settings.autoCenter ? "center" : "flex-start", justifyContent: settings.sizing === "fit" || settings.autoCenter ? "center" : "flex-start" }}>
                    <img
                      className={"print-preview-paper " + (settings.autoRotate && captured?.size && ((captured.size[0] > captured.size[1]) !== (settings.orientation === "landscape")) ? "auto-rotated" + (settings.autoCenter ? " auto-centered" : "") : "")}
                      src={image}
                      alt={paperLabel + " preview"}
                      style={previewImageStyle}
                    />
                  </div>
                )}
                {settings.mode === "poster" && image && (
                  <div className="poster-preview-grid" style={{ width: "100%", height: "100%", gridTemplateColumns: `repeat(${posterCols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${posterRows}, minmax(0,1fr))`, gap: 2 }}>
                    {Array.from({ length: posterRows * posterCols }, (_, i) => {
                      const row = Math.floor(i / posterCols), col = i % posterCols;
                      const stepX = previewW - posterOverlap, stepY = previewH - posterOverlap;
                      const left = posterOffsetX - col * stepX + (posterRotate ? (posterRawH - posterRawW) / 2 : 0);
                      const top = posterOffsetY - row * stepY + (posterRotate ? (posterRawW - posterRawH) / 2 : 0);
                      return <div className="poster-tile" key={i} style={{ position: "relative", overflow: "hidden", minWidth: 0, minHeight: 0, background: "#fff", border: "1px solid #cfd3d8" }}>
                        <img src={image} alt="" style={{ position: "absolute", maxWidth: "none", maxHeight: "none", width: `${posterRawW / previewW * 100}%`, height: `${posterRawH / previewH * 100}%`, left: `${left / previewW * 100}%`, top: `${top / previewH * 100}%`, transform: posterRotate ? "rotate(90deg)" : undefined, transformOrigin: "center", filter: settings.gray ? "grayscale(1)" : "none" }} />
                        {settings.posterCutMarks && <span aria-hidden="true" style={{ position: "absolute", inset: 3, border: "1px dashed #333", pointerEvents: "none" }} />}
                        {settings.posterLabels && <small style={{ position: "absolute", left: 3, bottom: 2, background: "#fff", color: "#222", fontSize: 8 }}>{page + 1} · {row + 1},{col + 1}</small>}
                      </div>;
                    })}
                  </div>
                )}
                {settings.mode === "multiple" && (
                  <div className="multiple-preview-grid" style={{ gridTemplateColumns: `repeat(${gridSpec(settings.pagesPerSheet).columns}, 1fr)`, gridTemplateRows: `repeat(${gridSpec(settings.pagesPerSheet).rows}, 1fr)` }}>
                    {selectedMultiple.map((cellIndex, slot) => {
                      const index = multipleStart + slot;
                      const grid = gridSpec(settings.pagesPerSheet);
                      return <div className="multiple-preview-cell" key={slot} style={{ gridColumn: cellIndex % grid.columns + 1, gridRow: Math.floor(cellIndex / grid.columns) + 1 }}>{images[index] && <img src={images[index]} alt={`Page ${index + 1}`} style={{ filter: settings.gray ? "grayscale(1)" : "none" }} />}</div>;
                    })}
                  </div>
                )}
                {settings.mode === "booklet" && (
                  <div className="booklet-preview-grid">
                    {bookletPreviewPages.map((index, i) => <div className="booklet-preview-cell" key={i}>{index !== null && images[index] && <img src={images[index]} alt={`Booklet page ${index + 1}`} style={{ filter: settings.gray ? "grayscale(1)" : "none" }} />}</div>)}
                  </div>
                )}
              </div>
            </div>
            <div className="print-preview-status" aria-live="polite">{printing ? "Printing…" : ""}</div>
            <div className="print-page-controls">
              <button disabled={page === 0} onClick={() => setPage(0)} aria-label="First page"><ChevronsLeft size={16} /></button>
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0,p-1))} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span>{page + 1} / {Math.max(total,1)}</span>
              <button disabled={page >= total - 1} onClick={() => setPage((p) => Math.min(total-1,p+1))} aria-label="Next page"><ChevronRight size={16} /></button>
              <button disabled={page >= total - 1} onClick={() => setPage(Math.max(0,total-1))} aria-label="Last page"><ChevronsRight size={16} /></button>
            </div>
          </main>
        </div>

        <footer className="print-preview-footer print-preview-white-footer">
          <span>{settings.paperSize} · {total} page{total === 1 ? "" : "s"} · {settings.mode[0].toUpperCase() + settings.mode.slice(1)}</span>
          <div>
            <Button variant="secondary" type="button" disabled={printing} onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={printing || !total} onClick={handlePrint}>
              {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Print
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
