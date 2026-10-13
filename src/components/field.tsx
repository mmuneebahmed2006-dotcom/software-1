import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type FormEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  align?: "left" | "right" | "center";
}

export function TextField({ value, onChange, placeholder, className, ariaLabel, align = "left" }: TextFieldProps) {
  return (
    <input
      type="text"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn("editable w-full border-0 bg-transparent p-0.5", className)}
      style={{ textAlign: align }}
    />
  );
}

function measureTextLayout(element: HTMLTextAreaElement, text: string) {
  const computed = getComputedStyle(element);
  const mirror = document.createElement("textarea");
  const width = element.getBoundingClientRect().width;
  Object.assign(mirror.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: computed.boxSizing,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
    height: "auto",
    minHeight: "0",
    maxHeight: "none",
    margin: "0",
    border: computed.border,
    padding: computed.padding,
    font: computed.font,
    letterSpacing: computed.letterSpacing,
    wordSpacing: computed.wordSpacing,
    lineHeight: computed.lineHeight,
    textIndent: computed.textIndent,
    textTransform: computed.textTransform,
    textAlign: computed.textAlign,
    direction: computed.direction,
    whiteSpace: "pre-wrap",
    overflowWrap: computed.overflowWrap,
    wordBreak: computed.wordBreak,
    tabSize: computed.tabSize,
    overflow: "hidden",
    resize: "none",
  });

  mirror.rows = 1;
  mirror.wrap = "soft";
  document.body.appendChild(mirror);
  const paddingHeight = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
  mirror.value = "M";
  const oneLineHeight = Math.max(1, mirror.scrollHeight - paddingHeight);
  // Keep a trailing newline as a visible second line during measurement.
  mirror.value = text.endsWith("\n") ? `${text}\u200b` : text || "\u200b";
  const contentHeight = Math.max(oneLineHeight, mirror.scrollHeight - paddingHeight);
  mirror.remove();

  return {
    lines: Math.max(1, Math.round(contentHeight / oneLineHeight)),
    lineHeight: oneLineHeight,
    paddingHeight,
  };
}

function insertAtSelection(element: HTMLTextAreaElement, insertedText: string) {
  return element.value.slice(0, element.selectionStart) + insertedText + element.value.slice(element.selectionEnd);
}

function eventInsertion(event: InputEvent) {
  if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph") return "\n";
  if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
    return event.dataTransfer?.getData("text/plain") ?? event.data ?? "";
  }
  return event.data ?? "";
}

export function AutoGrowTextField({ value, onChange, placeholder, className, ariaLabel, style }: Omit<TextFieldProps, "align"> & { style?: CSSProperties }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const acceptedValue = useRef(value);
  const mounted = useRef(false);
  const rejectedSelection = useRef<{ start: number; end: number; direction: "forward" | "backward" | "none" | null } | null>(null);
  const deletingInput = useRef(false);

  const fits = useCallback((element: HTMLTextAreaElement, candidate: string) =>
    measureTextLayout(element, candidate).lines <= 2, []);

  const syncHeight = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const { lines, lineHeight, paddingHeight } = measureTextLayout(element, element.value);
    const borderHeight = parseFloat(getComputedStyle(element).borderTopWidth) + parseFloat(getComputedStyle(element).borderBottomWidth);
    const visualLines = Math.min(2, Math.max(1, lines));
    const contentHeight = lineHeight * visualLines + paddingHeight + borderHeight;
    element.style.height = `${contentHeight}px`;
    element.style.minHeight = `${contentHeight}px`;
    element.style.maxHeight = `${contentHeight}px`;
    element.style.overflowY = "hidden";
    element.style.overflowX = "hidden";
    element.scrollTop = 0;
  }, []);

  const rejectEdit = useCallback((element: HTMLTextAreaElement) => {
    const previous = acceptedValue.current;
    const selection = rejectedSelection.current;
    element.value = previous;
    requestAnimationFrame(() => {
      if (ref.current !== element) return;
      const position = Math.min(selection?.start ?? previous.length, previous.length);
      element.setSelectionRange(position, Math.min(selection?.end ?? position, previous.length), selection?.direction ?? "none");
    });
  }, []);

  const handleBeforeInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent as InputEvent;
    const element = event.currentTarget;
    if (native.inputType.startsWith("delete")) {
      deletingInput.current = true;
      rejectedSelection.current = null;
      return;
    }
    deletingInput.current = false;
    if (!native.inputType.startsWith("insert")) return;
    const candidate = insertAtSelection(element, eventInsertion(native));
    rejectedSelection.current = {
      start: element.selectionStart,
      end: element.selectionEnd,
      direction: element.selectionDirection,
    };
    if (!fits(element, candidate)) event.preventDefault();
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const candidate = insertAtSelection(element, event.clipboardData.getData("text/plain"));
    if (!fits(element, candidate)) {
      rejectedSelection.current = {
        start: element.selectionStart,
        end: element.selectionEnd,
        direction: element.selectionDirection,
      };
      event.preventDefault();
    }
  };

  const handleDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const text = event.dataTransfer.getData("text/plain");
    if (!text) return;
    const candidate = insertAtSelection(element, text);
    if (!fits(element, candidate)) {
      event.preventDefault();
      rejectedSelection.current = {
        start: element.selectionStart,
        end: element.selectionEnd,
        direction: element.selectionDirection,
      };
      return;
    }
    event.preventDefault();
    element.setRangeText(text, element.selectionStart, element.selectionEnd, "end");
    acceptedValue.current = element.value;
    onChange(element.value);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const nextValue = element.value;
    const isDeletion = deletingInput.current && nextValue.length < acceptedValue.current.length;
    deletingInput.current = false;
    if (fits(element, nextValue) || isDeletion) {
      acceptedValue.current = nextValue;
      rejectedSelection.current = null;
      onChange(nextValue);
      return;
    }
    // Fallback for non-cancelable beforeinput events and scripted DOM edits.
    rejectEdit(element);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.isComposing) return;
    const element = event.currentTarget;
    const candidate = insertAtSelection(element, "\n");
    rejectedSelection.current = {
      start: element.selectionStart,
      end: element.selectionEnd,
      direction: element.selectionDirection,
    };
    if (!fits(element, candidate)) event.preventDefault();
  };

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Existing saved names are preserved on load, even if a changed font or
    // width makes them overflow. New external updates are capacity-checked.
    if (!mounted.current) {
      mounted.current = true;
      acceptedValue.current = value;
    } else if (value !== acceptedValue.current) {
      if (fits(element, value)) acceptedValue.current = value;
      else onChange(acceptedValue.current);
    }
    syncHeight();
  }, [fits, onChange, syncHeight, value]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncHeight);
      return () => window.removeEventListener("resize", syncHeight);
    }
    const observer = new ResizeObserver(syncHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [syncHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      wrap="soft"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      title={value || undefined}
      onBeforeInput={handleBeforeInput}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn("editable w-full resize-none overflow-hidden border-0 bg-transparent p-0.5", className)}
      style={{ boxSizing: "border-box", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word", overflowX: "hidden", overflowY: "hidden", lineHeight: "normal", resize: "none", ...style }}
    />
  );
}

export function AreaField({ value, onChange, placeholder, className, ariaLabel }: Omit<TextFieldProps, "align">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn("editable w-full resize-none overflow-hidden border-0 bg-transparent p-0.5 leading-snug", className)}
    />
  );
}

/** Terms editor: starts at one line and grows only after Enter creates a new line. */
export function TermsField({ value, onChange, placeholder, className, ariaLabel }: Omit<TextFieldProps, "align">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const getLineCount = (text: string) => Math.min(3, Math.max(1, text.split("\n").length));

  const syncHeight = () => {
    const element = ref.current;
    if (!element) return;
    const lineCount = getLineCount(element.value);
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 18;
    const padding = 2;
    const height = lineCount * lineHeight + padding;
    element.style.height = `${height}px`;
    element.style.minHeight = `${height}px`;
    element.style.maxHeight = `${height}px`;
    element.style.overflowY = "hidden";
    element.scrollTop = 0;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    const lineCount = getLineCount(event.currentTarget.value);
    if (lineCount >= 3) {
      event.preventDefault();
      return;
    }
    requestAnimationFrame(syncHeight);
  };

  useLayoutEffect(syncHeight, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
        requestAnimationFrame(syncHeight);
      }}
      onKeyDown={handleKeyDown}
      className={cn("editable w-full resize-none overflow-hidden border-0 bg-transparent p-0.5 leading-snug", className)}
      style={{
        height: "20px",
        minHeight: "20px",
        maxHeight: "20px",
        lineHeight: "18px",
        overflowY: "hidden",
      }}
    />
  );
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
  step?: number;
  style?: CSSProperties;
}

export function NumberField({ value, onChange, ariaLabel, className, step = 1, style }: NumberFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : "");
  const lastValue = useRef(value);

  // Keep user-entered text (including a temporarily empty value) while focused.
  // This avoids React restoring the previous number during Backspace/delete edits.
  useEffect(() => {
    if (Object.is(lastValue.current, value)) return;
    lastValue.current = value;
    if (document.activeElement !== inputRef.current) {
      setDraft(Number.isFinite(value) ? String(value) : "");
    }
  }, [value]);

  const updateDraft = (next: string) => {
    // Never reject an edit here: Backspace/Delete must always update the visible draft.
    setDraft(next);
    const parsed = next.trim() === "" ? 0 : Number(next);
    if (Number.isFinite(parsed) && parsed >= 0) {
      lastValue.current = parsed;
      onChange(parsed);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => updateDraft(event.target.value)}
      onBlur={() => {
        const parsed = draft.trim() === "" ? 0 : Number(draft);
        if (Number.isFinite(parsed) && parsed >= 0) {
          lastValue.current = parsed;
          onChange(parsed);
          setDraft(String(parsed));
        } else {
          setDraft(Number.isFinite(value) ? String(value) : "");
        }
      }}
      className={cn("editable w-full border-0 bg-transparent p-0.5 tabular-nums", className)}
      style={style}
      data-step={step}
    />
  );
}
