import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

export function useHistoryState<T>(initial: () => T) {
  const [state, setCurrent] = useState<T>(initial);
  const past = useRef<T[]>([]); const future = useRef<T[]>([]);
  const setState: Dispatch<SetStateAction<T>> = useCallback((next) => {
    setCurrent((current) => { const value = typeof next === "function" ? (next as (v: T) => T)(current) : next; if (Object.is(value, current)) return current; past.current = [...past.current.slice(-49), current]; future.current = []; return value });
  }, []);
  const reset = useCallback((value: T) => { past.current = []; future.current = []; setCurrent(value) }, []);
  const undo = useCallback(() => setCurrent((current) => { const value = past.current.pop(); if (!value) return current; future.current.push(current); return value }), []);
  const redo = useCallback(() => setCurrent((current) => { const value = future.current.pop(); if (!value) return current; past.current.push(current); return value }), []);
  return { state, setState, reset, undo, redo };
}