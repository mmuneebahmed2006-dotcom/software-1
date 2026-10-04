import type { CompanyDetails, SavedDocument } from "@/lib/document";

export interface DesktopSettings { initialized: boolean; dataRoot: string | null; lastBackupAt: number | null }
export interface RestoreResult { imported: number; skipped: number; dataRoot: string }
export interface DesktopApi {
  getSettings(): Promise<DesktopSettings>;
  chooseDataRoot(): Promise<string | null>;
  initialize(dataRoot: string): Promise<DesktopSettings>;
  restore(): Promise<RestoreResult | null>;
  listDocuments(): Promise<SavedDocument[]>;
  saveDocument(document: SavedDocument, pdfData?: string): Promise<SavedDocument>;
  renameDocument(document: SavedDocument, title: string): Promise<SavedDocument>;
  deleteDocument(document: SavedDocument): Promise<void>;
  createFolder(category: string, name: string): Promise<string[]>;
  listFolders(category: string): Promise<string[]>;
  renameFolder?(category: string, from: string, to: string): Promise<string[]>;
  deleteFolder?(category: string, name: string): Promise<string[]>;
  savePdf(name: string, data: string, docType?: string): Promise<boolean>;
  saveZip?(name: string, data: string): Promise<boolean>;
  getBasePath?(): Promise<string | null>;
  savePdfToLibrary?(docType: string, folder: string, fileName: string, data: string): Promise<string>;
  exportSelected(ids: string[], from?: number, to?: number): Promise<number>;
  backup(): Promise<string | null>;
  restoreBackup(): Promise<RestoreResult | null>;
  getCompanyDetails(): Promise<CompanyDetails>;
  saveCompanyDetails(details: CompanyDetails): Promise<CompanyDetails>;
  updatePreviousCompanyDetails(details: CompanyDetails): Promise<SavedDocument[]>;
  listPrinters(): Promise<PrinterInfo[]>;
  printDocument(options: PrintOptions): Promise<boolean>;
  openPrinterSettings?(deviceName?: string): Promise<boolean>;
}

declare global { interface Window { desktop?: DesktopApi } }
export {};
export interface PrinterInfo { name: string; displayName: string; description: string; options: Record<string, string> }
export interface PrintOptions { images?: string[]; mode?: "size"|"poster"|"multiple"|"booklet"; posterTiles?: 2|3|4; deviceName?: string; silent?: boolean; gray?: boolean; landscape?: boolean; scaleFactor?: number; pagesPerSheet?: number; copies?: number; pageRanges?: Array<{ from: number; to: number }>; duplex?: "simplex" | "shortEdge" | "longEdge"; paperSize?: string; dpi?: number; }
