import { useEffect, useState } from "react";
import { normalizeDocumentState, type SavedDocument } from "@/lib/document";

const STORAGE_KEY = "8wc-document-studio-v2";

export function useSavedDocuments() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedDocument[];
        setDocuments(parsed.map((document) => ({ ...document, state: normalizeDocumentState(document.state) })));
      }
    } catch {
      setDocuments([]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  }, [documents, ready]);

  return { documents, setDocuments, ready };
}