import type { SavedDocument } from "@/lib/document";

export interface DesktopSettings { initialized: boolean; dataRoot: string | null; lastBackupAt: number | null }
export interface RestoreResult { imported: number; skipped: number; dataRoot: string }
export interface DesktopApi {
  getSettings(): Promise<DesktopSettings>;
  chooseDataRoot(): Promise<string | null>;
  initialize(dataRoot: string): Promise<DesktopSettings>;
  restore(): Promise<RestoreResult | null>;
  listDocuments(): Promise<SavedDocument[]>;
  saveDocument(document: SavedDocument, pdfData?: string): Promise<SavedDocument>;
  deleteDocument(document: SavedDocument): Promise<void>;
  createFolder(category: string, name: string): Promise<void>;
  savePdf(name: string, data: string): Promise<boolean>;
  exportSelected(ids: string[]): Promise<number>;
  backup(from?: number, to?: number): Promise<string | null>;
}

declare global { interface Window { desktop?: DesktopApi } }
export {};