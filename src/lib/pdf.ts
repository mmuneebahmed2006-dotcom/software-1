import { getFontEmbedCSS, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PAPER_SIZES, type PaperSizeKey } from "@/lib/document";

export interface CapturedDocument { images: string[]; size: [number, number] }

/** Rasterises document pages at print-ready resolution without excessive canvas memory use. */
export async function capturePages(root: ParentNode, paperSize: PaperSizeKey): Promise<CapturedDocument> {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (!elements.length) throw new Error("No document pages");
  const pageContainer = elements[0].closest<HTMLElement>("#document-pages");
  const previousTransform = pageContainer?.style.transform ?? "";
  const previousTransition = pageContainer?.style.transition ?? "";
  const previousPaddingBottom = pageContainer?.style.paddingBottom ?? "";
  const previousPageStyles = elements.map((element) => ({
    height: element.style.height,
    minHeight: element.style.minHeight,
    overflow: element.style.overflow,
  }));
  elements.forEach((element) => {
    element.classList.add("exporting");
    element.style.height = "";
    element.style.minHeight = "";
    element.style.overflow = "visible";
  });
  // The editor has a visual zoom transform. html-to-image otherwise measures the
  // transformed rectangle and can capture only part of the paper.
  if (pageContainer) {
    pageContainer.style.transform = "none";
    pageContainer.style.transition = "none";
    pageContainer.style.paddingBottom = "0";
  }
  try {
    const images: string[] = [];
    // Keep exported typography identical to the live preview by embedding the same font CSS.
    if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
    const fontEmbedCSS = await getFontEmbedCSS(elements[0]);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const width = Math.round(element.offsetWidth || rect.width);
      const height = Math.round(element.offsetHeight || rect.height);
      images.push(await toPng(element, {
        width,
        height,
        pixelRatio: 2,
        backgroundColor: "white",
        fontEmbedCSS,
        skipFonts: false,
        style: {
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
          boxShadow: "none",
          overflow: "visible",
          boxSizing: "border-box",
          width: `${width}px`,
          minWidth: `${width}px`,
          height: `${height}px`,
          minHeight: `${height}px`,
        },
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { images, size: PAPER_SIZES[paperSize].pdf };
  } finally {
    elements.forEach((element, index) => {
      element.classList.remove("exporting");
      element.style.height = previousPageStyles[index].height;
      element.style.minHeight = previousPageStyles[index].minHeight;
      element.style.overflow = previousPageStyles[index].overflow;
    });
    if (pageContainer) {
      pageContainer.style.transform = previousTransform;
      pageContainer.style.transition = previousTransition;
      pageContainer.style.paddingBottom = previousPaddingBottom;
    }
  }
}

/** Builds a print-ready PDF using the same full-page image placement as Download PDF. */
export async function buildPrintPdf(
  captured: CapturedDocument,
  options: {
    paperSize: PaperSizeKey;
    landscape: boolean;
    sizing: "fit" | "actual" | "custom";
    scale: number;
    autoRotate: boolean;
    autoCenter: boolean;
    gray: boolean;
    pageIndices: number[];
  },
): Promise<Blob> {
  const [paperW, paperH] = PAPER_SIZES[options.paperSize].pdf;
  const pageW = options.landscape ? paperH : paperW;
  const pageH = options.landscape ? paperW : paperH;
  const [sourceW, sourceH] = captured.size;
  const orientation = options.landscape ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: [pageW, pageH], compress: true });

  for (const [outputIndex, pageIndex] of options.pageIndices.entries()) {
    const original = captured.images[pageIndex];
    if (!original) continue;
    const rotate = options.autoRotate && ((sourceW > sourceH) !== (pageW > pageH));
    let image = original;
    let drawSourceW = sourceW;
    let drawSourceH = sourceH;

    if (rotate || options.gray) {
      image = await transformPrintImage(original, rotate, options.gray);
      if (rotate) [drawSourceW, drawSourceH] = [sourceH, sourceW];
    }

    const factor = options.sizing === "fit"
      ? Math.min(pageW / drawSourceW, pageH / drawSourceH)
      : options.sizing === "custom"
        ? Math.min(400, Math.max(10, Number(options.scale) || 100)) / 100
        : 1;
    const drawW = drawSourceW * factor;
    const drawH = drawSourceH * factor;
    const x = options.autoCenter ? (pageW - drawW) / 2 : 0;
    const y = options.autoCenter ? (pageH - drawH) / 2 : 0;

    if (outputIndex > 0) pdf.addPage([pageW, pageH], orientation);
    pdf.addImage(image, "PNG", x, y, drawW, drawH, undefined, "NONE");
  }

  return pdf.output("blob");
}

function transformPrintImage(dataUrl: string, rotate: boolean, gray: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = rotate ? image.naturalHeight : image.naturalWidth;
      canvas.height = rotate ? image.naturalWidth : image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Could not prepare the print image."));
      context.filter = gray ? "grayscale(1)" : "none";
      if (rotate) {
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate(Math.PI / 2);
        context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      } else {
        context.drawImage(image, 0, 0);
      }
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not prepare the print image."));
    image.src = dataUrl;
  });
}

/** Builds one PDF blob out of one or more captured documents. */
export function buildPdf(captured: CapturedDocument[]): Blob {
  const first = captured[0];
  if (!first) throw new Error("Nothing to export");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: first.size, compress: true });
  let page = 0;
  for (const entry of captured) {
    for (const image of entry.images) {
      if (page > 0) pdf.addPage(entry.size, "portrait");
      pdf.addImage(image, "PNG", 0, 0, entry.size[0], entry.size[1], undefined, "NONE");
      page++;
    }
  }
  return pdf.output("blob");
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the generated file"));
    reader.readAsDataURL(blob);
  });
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<{
    createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
}

/**
 * Saves a blob, always offering a location picker.
 * Returns false when the user cancels, so callers can stay silent.
 */
export async function saveFile(blob: Blob, fileName: string, mime: string, docType?: string): Promise<boolean> {
  const desktop = window.desktop;
  if (desktop) {
    const data = await blobToDataUrl(blob);
    if (mime === "application/zip") return Boolean(await desktop.saveZip?.(fileName, data));
    return Boolean(await desktop.savePdf(fileName, data, docType));
  }
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const extension = fileName.slice(fileName.lastIndexOf("."));
      const handle = await picker.call(window, { suggestedName: fileName, types: [{ description: extension.slice(1).toUpperCase(), accept: { [mime]: [extension] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
