import { useEffect, useMemo, useState } from "react";
import { Printer, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ZoomIn, ZoomOut, RotateCcw, Settings, RefreshCw, SlidersHorizontal, Loader2 } from "lucide-react";
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
  range: "current" | "view" | "all" | "custom";
  customRange: string;
  reversePages: boolean;
  printAsImage: boolean;
  dpi: 150 | 300 | 600;
  printerName: string;
  pagesPerSheet: 1 | 2 | 4 | 6 | 9 | 16;
  posterTiles: 2 | 3 | 4;
};

type Props = {
  open: boolean;
  captured: CapturedDocument | null;
  paperLabel: string;
  fileName: string;
  onClose: () => void;
  onPrint: (settings: PrintSettings) => void | Promise<void>;
};

const PAPER_OPTIONS = [
  ["A4 21 × 29.7 cm", "A4"],
  ["A5 14.8 × 21 cm", "A5"],
  ["Letter 8.5 × 11 in", "Letter"],
  ["Legal 8.5 × 14 in", "Legal"],
] as const;

export function PrintPreview({ open, captured, paperLabel, fileName, onClose, onPrint }: Props) {
  const [settings, setSettings] = useState<PrintSettings>({
    gray: false, printDocument: true, printComment: true, printForm: true,
    sides: "single", copies: 1, paperSize: "A4 21 × 29.7 cm",
    mode: "size", sizing: "fit", scale: 100, autoRotate: true, autoCenter: true,
    orientation: "portrait", range: "all", customRange: "1", reversePages: false,
    printAsImage: true, dpi: 300, printerName: "", pagesPerSheet: 1, posterTiles: 2,
  });
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; description: string; options: Record<string, string> }>>([]);
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [zoom, setZoom] = useState(90);
  const images = captured?.images ?? [];
  const handlePrint = async () => { setPrinting(true); try { await onPrint(settings); } finally { setPrinting(false); } };
  const total = images.length;
  const image = images[page] ?? images[0];

  const patch = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const loadPrinters = async () => {
    if (!window.desktop?.listPrinters) return;
    try {
      const list = await window.desktop.listPrinters();
      setPrinters(list);
      const preferred = list[0]?.name ?? "";
      setSettings((s) => ({ ...s, printerName: s.printerName || preferred }));
    } catch {
      setPrinters([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadPrinters();
    const timer = window.setInterval(() => void loadPrinters(), 3000);
    return () => window.clearInterval(timer);
  }, [open]);

  const previewClass = useMemo(() => [
    "print-output-preview",
    `mode-${settings.mode}`,
    `orientation-${settings.orientation}`,
    settings.autoCenter ? "auto-center" : "",
  ].filter(Boolean).join(" "), [settings.mode, settings.orientation, settings.autoCenter]);

  if (!open) return null;

  return (
    <div className="print-preview-overlay" role="dialog" aria-modal="true" aria-label="Print preview">
      <div className="print-preview-window print-preview-white print-preview-three-columns">
        <header className="print-preview-titlebar">
          <div className="print-title-left"><Printer size={17} /><span>Print</span><small>{fileName}</small></div>
          <button type="button" onClick={onClose} disabled={printing} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="print-preview-body">
          <aside className="print-settings-panel">
            <section className="print-setting-group print-group-printer">
              <div className="print-section-title"><h3>Printer</h3><button type="button" className="print-icon-button" onClick={() => void loadPrinters()} title="Refresh printers"><RefreshCw size={14} /></button></div>
              <div className="print-printer-row">
                <select aria-label="Printer" value={settings.printerName} onChange={(e) => patch("printerName", e.target.value)}>
                  {printers.length ? printers.map((printer) => <option key={printer.name} value={printer.name}>{printer.displayName || printer.name}</option>) : <option value="">System default printer</option>}
                </select>
                <button type="button" onClick={() => window.desktop?.openPrinterSettings?.(settings.printerName || undefined)} aria-label="Printer settings" title="Printer properties"><Settings size={15} /></button>
              </div>
              <div className="print-printer-hint">{(() => {
                const selected = printers.find((p) => p.name === settings.printerName);
                if (!selected) return "Ready to print · System default";
                const state = selected.options?.["printer-state"] ?? "";
                const reasons = selected.options?.["printer-state-reasons"] ?? "";
                const accepting = selected.options?.["printer-is-accepting-jobs"] !== "false";
                if (/offline|unavailable|stopped|error/i.test(reasons) || state === "5" || !accepting) return "Offline";
                if (state === "4" || /processing|printing/i.test(reasons)) return "Printing…";
                return "Ready to print";
              })()}</div>
            </section>

            <section className="print-setting-group print-group-content">
              <div className="print-section-title"><h3>Print Content</h3><SlidersHorizontal size={14} /></div>
              {([["printDocument","Document"],["printComment","Comment"],["printForm","Form"]] as const).map(([key, label]) => (
                <label className="print-check" key={key}><input type="checkbox" checked={settings[key]} onChange={(e) => patch(key, e.target.checked)} /> {label}</label>
              ))}
              <label className="print-check"><input type="checkbox" checked={settings.gray} onChange={(e) => patch("gray", e.target.checked)} /> Print in grayscale</label>
            </section>

            <section className="print-setting-group print-group-settings">
              <h3>Print Settings</h3>
              <label className="print-select-row"><span>Copies</span><input className="print-number-input" type="number" min={1} max={999} value={settings.copies} onChange={(e) => patch("copies", Math.max(1, Number(e.target.value) || 1))} /></label>
              <label className="print-select-row"><span>Paper</span><select value={settings.paperSize} onChange={(e) => patch("paperSize", e.target.value)}>{PAPER_OPTIONS.map(([label]) => <option key={label}>{label}</option>)}</select></label>
              <label className="print-select-row"><span>Print sides</span><select value={settings.sides} onChange={(e) => patch("sides", e.target.value as PrintSettings["sides"])}><option value="single">Single side</option><option value="double">Double side</option></select></label>
            </section>

            <section className="print-setting-group print-mode-group print-group-mode">
              <h3>Page sizing &amp; handling</h3>
              <div className="print-mode-tabs" role="tablist">
                {([["size","Size"],["poster","Poster"],["multiple","Multiple"],["booklet","Booklet"]] as const).map(([mode,label]) => (
                  <button type="button" role="tab" aria-selected={settings.mode === mode} key={mode} className={settings.mode === mode ? "active" : ""} onClick={() => {
                    patch("mode", mode);
                    if (mode === "size") { patch("pagesPerSheet", 1); patch("sides", "single"); }
                    if (mode === "multiple") patch("pagesPerSheet", 4);
                    if (mode === "booklet") { patch("pagesPerSheet", 2); patch("sides", "double"); }
                  }}>{label}</button>
                ))}
              </div>

              {settings.mode === "size" && (
                <>
                  <div className="print-card-note">Print the document as individual pages. The preview and output use the same captured page image.</div>
                  <div className="print-radio-list">
                    <label><input type="radio" checked={settings.sizing === "fit"} onChange={() => patch("sizing","fit")} /> Fit</label>
                    <label><input type="radio" checked={settings.sizing === "actual"} onChange={() => patch("sizing","actual")} /> Actual size</label>
                    <label><input type="radio" checked={settings.sizing === "custom"} onChange={() => patch("sizing","custom")} /> Custom scale <input className="print-scale-input" type="number" min={10} max={400} value={settings.scale} disabled={settings.sizing !== "custom"} onChange={(e) => patch("scale", Math.max(10, Math.min(400, Number(e.target.value) || 100)))} />%</label>
                  </div>
                </>
              )}

              {settings.mode === "poster" && (
                <>
                  <div className="print-card-note">Poster mode splits one enlarged page across multiple physical sheets.</div>
                  <label className="print-select-row"><span>Tile</span><select value={settings.posterTiles} onChange={(e) => patch("posterTiles", Number(e.target.value) as PrintSettings["posterTiles"])}><option value={2}>2 × 2 sheets</option><option value={3}>3 × 3 sheets</option><option value={4}>4 × 4 sheets</option></select></label>
                  <label className="print-select-row"><span>Scale</span><input className="print-number-input" type="number" min={150} max={400} value={settings.scale} onChange={(e) => patch("scale", Math.max(150, Math.min(400, Number(e.target.value) || 200)))} /></label>
                  <div className="print-card-note">Use Tile to control the number of sheets. Scale is applied to the document before tiling.</div>
                </>
              )}

              {settings.mode === "multiple" && (
                <>
                  <div className="print-card-note">Place multiple document pages on one physical sheet.</div>
                  <label className="print-select-row"><span>Pages/sheet</span><select value={settings.pagesPerSheet} onChange={(e) => patch("pagesPerSheet", Number(e.target.value) as PrintSettings["pagesPerSheet"])}>{[2,4,6,9,16].map((n) => <option key={n} value={n}>{n} pages</option>)}</select></label>
                </>
              )}

              {settings.mode === "booklet" && (
                <>
                  <div className="print-card-note">Booklet mode arranges pages two-up and uses double-sided printing.</div>
                  <label className="print-select-row"><span>Binding</span><select><option>Left binding</option><option>Right binding</option></select></label>
                  <label className="print-select-row"><span>Sheets</span><span className="print-static-value">{Math.ceil(total / 4)}</span></label>
                </>
              )}
            </section>

            <section className="print-setting-group print-group-orientation">
              <h3>Orientation</h3>
              <div className="print-orientation">
                <button type="button" className={settings.orientation === "portrait" ? "active" : ""} onClick={() => patch("orientation","portrait")}><span className="orientation-icon portrait-icon" /> Portrait</button>
                <button type="button" className={settings.orientation === "landscape" ? "active" : ""} onClick={() => patch("orientation","landscape")}><span className="orientation-icon landscape-icon" /> Landscape</button>
              </div>
              <label className="print-check"><input type="checkbox" checked={settings.autoRotate} onChange={(e) => patch("autoRotate", e.target.checked)} /> Auto rotate</label>
              <label className="print-check"><input type="checkbox" checked={settings.autoCenter} onChange={(e) => patch("autoCenter", e.target.checked)} /> Auto center</label>
            </section>

            <section className="print-setting-group print-group-range">
              <h3>Page range</h3>
              <div className="print-range-grid">
                {([["current","Current page"],["view","Current view"],["all","All pages"],["custom","Custom"]] as const).map(([range,label]) => (
                  <label className="print-check" key={range}><input type="radio" checked={settings.range === range} onChange={() => patch("range",range)} /> {label}</label>
                ))}
              </div>
              <div className="print-custom-range"><input disabled={settings.range !== "custom"} value={settings.customRange} onChange={(e) => patch("customRange",e.target.value)} placeholder="1-3,5" /><span>/ {total}</span></div>
              <label className="print-check"><input type="checkbox" checked={settings.reversePages} onChange={(e) => patch("reversePages",e.target.checked)} /> Reverse pages</label>
            </section>

            <section className="print-setting-group print-group-quality">
              <h3>Output quality</h3>
              <label className="print-check"><input type="checkbox" checked={settings.printAsImage} onChange={(e) => patch("printAsImage", e.target.checked)} /> Print as image</label>
              <label className="print-select-row"><span>DPI</span><select value={settings.dpi} disabled={!settings.printAsImage} onChange={(e) => patch("dpi", Number(e.target.value) as PrintSettings["dpi"])}><option value={150}>150 dpi</option><option value={300}>300 dpi</option><option value={600}>600 dpi</option></select></label>
            </section>
          </aside>

          <main className="print-preview-stage print-preview-stage-light">
            <div className="print-preview-toolbar"><span>Preview</span><span>{settings.mode === "multiple" ? `${settings.pagesPerSheet} pages / sheet` : settings.mode === "poster" ? `${settings.posterTiles} × ${settings.posterTiles} poster` : settings.mode === "booklet" ? "Booklet · 2-up" : settings.orientation === "landscape" ? "Landscape" : "Portrait"}</span></div>
            <div className="print-preview-paper-wrap">
              <div className={previewClass}>
                {settings.mode === "size" && image && <img className="print-preview-paper" src={image} alt={paperLabel + " preview"} style={{ filter: settings.gray ? "grayscale(1)" : "none", transform: settings.orientation === "landscape" ? "rotate(90deg) scale(.70)" : `scale(${settings.sizing === "custom" ? settings.scale / 100 : settings.sizing === "fit" ? .96 : 1})` }} />}
                {settings.mode === "poster" && image && (
                  <div className="poster-preview-grid" style={{ gridTemplateColumns: `repeat(${settings.posterTiles}, 1fr)`, gridTemplateRows: `repeat(${settings.posterTiles}, 1fr)` }}>
                    {Array.from({ length: settings.posterTiles * settings.posterTiles }, (_, i) => {
                      const row = Math.floor(i / settings.posterTiles), col = i % settings.posterTiles;
                      const size = settings.posterTiles * 100;
                      return <div className="poster-tile" key={i}><img src={image} alt="" style={{ filter: settings.gray ? "grayscale(1)" : "none", width: `${size}%`, height: `${size}%`, left: `-${col * 100}%`, top: `-${row * 100}%` }} /></div>;
                    })}
                  </div>
                )}
                {settings.mode === "multiple" && (
                  <div className="multiple-preview-grid" style={{ gridTemplateColumns: `repeat(${settings.pagesPerSheet >= 6 ? 3 : settings.pagesPerSheet === 2 ? 2 : 2}, 1fr)` }}>
                    {images.slice(0, settings.pagesPerSheet).map((src, i) => <div className="multiple-preview-cell" key={i}><img src={src} alt={`Page ${i + 1}`} style={{ filter: settings.gray ? "grayscale(1)" : "none" }} /></div>)}
                  </div>
                )}
                {settings.mode === "booklet" && (
                  <div className="booklet-preview-grid">
                    {(images.slice(0,2)).map((src, i) => <div className="booklet-preview-cell" key={i}><img src={src} alt={`Booklet page ${i + 1}`} style={{ filter: settings.gray ? "grayscale(1)" : "none" }} /></div>)}
                  </div>
                )}
              </div>
            </div>

            <div className="print-preview-status" aria-live="polite">{printing ? "Printing…" : "Ready to print"}</div>
            <div className="print-page-controls">
              <button disabled={page === 0} onClick={() => setPage(0)} aria-label="First page"><ChevronsLeft size={16} /></button>
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0,p-1))} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span>{page + 1} / {Math.max(total,1)}</span>
              <button disabled={page >= total - 1} onClick={() => setPage((p) => Math.min(total-1,p+1))} aria-label="Next page"><ChevronRight size={16} /></button>
              <button disabled={page >= total - 1} onClick={() => setPage(Math.max(0,total-1))} aria-label="Last page"><ChevronsRight size={16} /></button>
            </div>
            <div className="print-preview-zoom">
              <button onClick={() => setZoom((z) => Math.max(50,z-10))}><ZoomOut size={15}/></button><strong>{zoom}%</strong><button onClick={() => setZoom((z) => Math.min(150,z+10))}><ZoomIn size={15}/></button><button onClick={() => setZoom(90)}><RotateCcw size={14}/></button>
            </div>
          </main>
        </div>

        <footer className="print-preview-footer print-preview-white-footer">
          <span>{paperLabel} · {total} page{total === 1 ? "" : "s"} · {settings.mode[0].toUpperCase() + settings.mode.slice(1)}</span>
          <div><Button variant="secondary" type="button" disabled={printing} onClick={onClose}>Cancel</Button><Button type="button" disabled={printing || !total} onClick={() => void handlePrint()}>{printing ? <><Loader2 size={16} className="animate-spin"/> Printing…</> : <><Printer size={16}/> Print</>}</Button></div>
        </footer>
      </div>
    </div>
  );
}
