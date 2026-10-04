import { getFontEmbedCSS, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PAPER_SIZES, type PaperSizeKey } from "@/lib/document";

export interface CapturedDocument { images: string[]; size: [number, number] }

/** Rasterises every `[data-pdf-page]` element inside `root` at high resolution. */
export async function capturePages(root: ParentNode, paperSize: PaperSizeKey): Promise<CapturedDocument> {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (!elements.length) throw new Error("No document pages");
  const pageContainer = elements[0].closest<HTMLElement>("#document-pages");
  const previousTransform = pageContainer?.style.transform ?? "";
  const previousTransition = pageContainer?.style.transition ?? "";
  const previousPaddingBottom = pageContainer?.style.paddingBottom ?? "";
  elements.forEach((element) => element.classList.add("exporting"));
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
        pixelRatio: 4,
        backgroundColor: "white",
        fontEmbedCSS,
        skipFonts: false,
        style: {
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
          boxShadow: "none",
          width: `${width}px`,
          height: `${height}px`,
        },
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { images, size: PAPER_SIZES[paperSize].pdf };
  } finally {
    elements.forEach((element) => element.classList.remove("exporting"));
    if (pageContainer) {
      pageContainer.style.transform = previousTransform;
      pageContainer.style.transition = previousTransition;
      pageContainer.style.paddingBottom = previousPaddingBottom;
    }
  }
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
