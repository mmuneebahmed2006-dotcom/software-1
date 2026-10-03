import { useState } from "react";
import { Printer, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
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
};

type Props = {
  open: boolean;
  captured: CapturedDocument | null;
  paperLabel: string;
  fileName: string;
  onClose: () => void;
  onPrint: (settings: PrintSettings) => void;
};

export function PrintPreview({ open, captured, paperLabel, fileName, onClose, onPrint }: Props) {
  const [settings, setSettings] = useState<PrintSettings>({
    gray: false,
    printDocument: true,
    printComment: true,
    printForm: true,
    sides: "single",
    copies: 1,
    paperSize: "A4 21 × 29.7 cm",
    mode: "size",
    sizing: "actual",
    scale: 100,
    autoRotate: true,
    autoCenter: true,
    orientation: "portrait",
    range: "all",
    customRange: "1",
    reversePages: false,
    printAsImage: false,
    dpi: 300,
  });

  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const images = captured?.images ?? [];
  const total = images.length;
  const image = images[page] ?? images[0];

  const patch = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  if (!open) return null;

  return (
    <div className="print-preview-overlay" role="dialog" aria-modal="true" aria-label="Print preview">
      <div className="print-preview-window">
        <header className="print-preview-titlebar">
          <span>Print</span>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="print-preview-body">
          <aside className="print-settings-panel">
            <section className="print-setting-group">
              <h3>Printer</h3>
              <div className="print-printer-row">
                <select aria-label="Printer" defaultValue="System Printer">
                  <option>System Printer</option>
                </select>
                <button type="button" aria-label="Printer settings" title="Printer settings">⚙</button>
              </div>
              <label className="print-check"><input type="checkbox" checked={settings.gray} onChange={(e) => patch("gray", e.target.checked)} /> Gray print</label>
            </section>

            <section className="print-setting-group">
              <h3>Print Content</h3>
              {(["printDocument", "printComment", "printForm"] as const).map((key, i) => (
                <label className="print-check" key={key}>
                  <input type="checkbox" checked={settings[key]} onChange={(e) => patch(key, e.target.checked)} />
                  {["Document", "Comment", "Form"][i]}
                </label>
              ))}
            </section>

            <section className="print-setting-group">
              <h3>Print Settings</h3>
              <div className="print-field-row">
                <span>Copies</span>
                <input className="print-number-input" type="number" min={1} max={999} value={settings.copies} onChange={(e) => patch("copies", Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <label className="print-select-row">
                <span>Paper</span>
                <select value={settings.paperSize} onChange={(e) => patch("paperSize", e.target.value)}>
                  <option>A4 21 × 29.7 cm</option>
                  <option>A5 14.8 × 21 cm</option>
                  <option>Letter 8.5 × 11 in</option>
                  <option>Legal 8.5 × 14 in</option>
                </select>
              </label>
              <label className="print-select-row">
                <span>Print sides</span>
                <select value={settings.sides} onChange={(e) => patch("sides", e.target.value as PrintSettings["sides"])}>
                  <option value="single">Single side</option>
                  <option value="double">Double side</option>
                </select>
              </label>
              <label className="print-check"><input type="checkbox" checked={settings.reversePages} onChange={(e) => patch("reversePages", e.target.checked)} /> Reverse pages</label>
              <label className="print-check"><input type="checkbox" checked={settings.printAsImage} onChange={(e) => patch("printAsImage", e.target.checked)} /> Print as image</label>
              <label className="print-select-row">
                <span>DPI</span>
                <select value={settings.dpi} disabled={!settings.printAsImage} onChange={(e) => patch("dpi", Number(e.target.value) as PrintSettings["dpi"])}>
                  <option value={150}>150 dpi</option>
                  <option value={300}>300 dpi</option>
                  <option value={600}>600 dpi</option>
                </select>
              </label>
            </section>

            <section className="print-setting-group">
              <h3>Print Mode</h3>
              <div className="print-mode-tabs">
                {(["size", "poster", "multiple", "booklet"] as const).map((mode) => (
                  <button type="button" key={mode} className={settings.mode === mode ? "active" : ""} onClick={() => patch("mode", mode)}>
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              <div className="print-radio-list">
                <label><input type="radio" checked={settings.sizing === "fit"} onChange={() => patch("sizing", "fit")} /> Fit</label>
                <label><input type="radio" checked={settings.sizing === "actual"} onChange={() => patch("sizing", "actual")} /> Actual size</label>
                <label>
                  <input type="radio" checked={settings.sizing === "custom"} onChange={() => patch("sizing", "custom")} />
                  Custom scale
                  <input className="print-scale-input" type="number" min={10} max={400} value={settings.scale} disabled={settings.sizing !== "custom"} onChange={(e) => patch("scale", Number(e.target.value) || 100)} />
                </label>
              </div>
              <label className="print-check"><input type="checkbox" checked={settings.autoRotate} onChange={(e) => patch("autoRotate", e.target.checked)} /> Auto rotate</label>
              <label className="print-check"><input type="checkbox" checked={settings.autoCenter} onChange={(e) => patch("autoCenter", e.target.checked)} /> Auto center</label>
            </section>

            <section className="print-setting-group">
              <h3>Orientation</h3>
              <div className="print-orientation">
                <button type="button" className={settings.orientation === "portrait" ? "active" : ""} onClick={() => patch("orientation", "portrait")} aria-label="Portrait">▯</button>
                <button type="button" className={settings.orientation === "landscape" ? "active" : ""} onClick={() => patch("orientation", "landscape")} aria-label="Landscape">▭</button>
              </div>
            </section>

            <section className="print-setting-group">
              <h3>Page Range</h3>
              <label className="print-check"><input type="radio" checked={settings.range === "current"} onChange={() => patch("range", "current")} /> Current page</label>
              <label className="print-check"><input type="radio" checked={settings.range === "view"} onChange={() => patch("range", "view")} /> Current view</label>
              <label className="print-check"><input type="radio" checked={settings.range === "all"} onChange={() => patch("range", "all")} /> All pages</label>
              <label className="print-check">
                <input type="radio" checked={settings.range === "custom"} onChange={() => patch("range", "custom")} />
                Custom
                <input className="print-range-input" disabled={settings.range !== "custom"} value={settings.customRange} onChange={(e) => patch("customRange", e.target.value)} />
                <span>/ {total}</span>
              </label>
            </section>
          </aside>

          <main className="print-preview-stage">
            <div className="print-preview-file">{fileName}</div>
            <div className="print-preview-paper-wrap">
              {image ? (
                <div className="print-preview-paper-holder" style={{ transform: `scale(${zoom / 100})` }}>
                  <img
                    className="print-preview-paper"
                    src={image}
                    alt={paperLabel + " preview"}
                    style={{ filter: settings.gray ? "grayscale(1)" : "none" }}
                  />
                </div>
              ) : (
                <div className="print-preview-empty">Preparing preview…</div>
              )}
            </div>

            <div className="print-page-controls">
              <button disabled={page === 0} onClick={() => setPage(0)} aria-label="First page"><ChevronsLeft size={16} /></button>
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span>{page + 1} / {Math.max(total, 1)}</span>
              <button disabled={page >= total - 1} onClick={() => setPage((p) => Math.min(total - 1, p + 1))} aria-label="Next page"><ChevronRight size={16} /></button>
              <button disabled={page >= total - 1} onClick={() => setPage(Math.max(0, total - 1))} aria-label="Last page"><ChevronsRight size={16} /></button>
            </div>

            <div className="print-preview-zoom">
              <button onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out"><ZoomOut size={15} /></button>
              <strong>{zoom}%</strong>
              <button onClick={() => setZoom((z) => Math.min(150, z + 10))} aria-label="Zoom in"><ZoomIn size={15} /></button>
              <button onClick={() => setZoom(100)} aria-label="Reset zoom" title="Reset zoom"><RotateCcw size={14} /></button>
            </div>
          </main>
        </div>

        <footer className="print-preview-footer">
          <span>{paperLabel} · {total} page{total === 1 ? "" : "s"}</span>
          <div>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={() => onPrint(settings)}><Printer size={16} /> Print</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
