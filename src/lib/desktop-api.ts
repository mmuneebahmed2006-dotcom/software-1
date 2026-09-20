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
  savePdf(name: string, data: string): Promise<boolean>;
  getBasePath?(): Promise<string | null>;
  savePdfToLibrary?(docType: string, folder: string, fileName: string, data: string): Promise<string>;
  exportSelected(ids: string[], from?: number, to?: number): Promise<number>;
  backup(): Promise<string | null>;
  restoreBackup(): Promise<RestoreResult | null>;
  getCompanyDetails(): Promise<CompanyDetails>;
  saveCompanyDetails(details: CompanyDetails): Promise<CompanyDetails>;
  updatePreviousCompanyDetails(details: CompanyDetails): Promise<SavedDocument[]>;
}

declare global { interface Window { desktop?: DesktopApi } }
export {};