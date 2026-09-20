import { useEffect, useState } from "react";
import { normalizeSavedDocument, type SavedDocument } from "@/lib/document";

const STORAGE_KEY = "8wc-document-studio-v3";

export function useSavedDocuments() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const source = window.desktop ? await window.desktop.listDocuments() : JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedDocument[];
        if (active) setDocuments(source.map(normalizeSavedDocument).sort((a, b) => b.updatedAt - a.updatedAt));
      } catch { if (active) setDocuments([]); }
      if (active) setReady(true);
    };
    const deferred = window.requestIdleCallback ? window.requestIdleCallback(() => void load()) : window.setTimeout(() => void load(), 0);
    return () => { active = false; if (window.cancelIdleCallback && typeof deferred === "number") window.cancelIdleCallback(deferred); else window.clearTimeout(deferred) };
  }, []);

  useEffect(() => {
    if (!ready || window.desktop) return;
    const timer = window.setTimeout(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents)), 250);
    return () => window.clearTimeout(timer);
  }, [documents, ready]);

  return { documents, setDocuments, ready };
}