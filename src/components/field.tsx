import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
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
  const mirror = document.createElement("div");
  Object.assign(mirror.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: "border-box",
    width: `${element.clientWidth}px`,
    margin: "0",
    border: "0",
    padding: computed.padding,
    font: computed.font,
    letterSpacing: computed.letterSpacing,
    wordSpacing: computed.wordSpacing,
    lineHeight: computed.lineHeight,
    textIndent: computed.textIndent,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: computed.wordBreak,
    tabSize: computed.tabSize,
  });

  const materializeTrailingLine = (value: string) => value.endsWith("\\n") ? `${value}\\u200b` : value || "\\u200b";
  mirror.textContent = "M";
  document.body.appendChild(mirror);
  const paddingHeight = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
  const oneLineHeight = Math.max(1, mirror.getBoundingClientRect().height - paddingHeight);
  mirror.textContent = materializeTrailingLine(text);
  const contentHeight = Math.max(oneLineHeight, mirror.getBoundingClientRect().height - paddingHeight);
  mirror.remove();

  return {
    lines: Math.max(1, Math.round(contentHeight / oneLineHeight)),
    lineHeight: oneLineHeight,
    paddingHeight,
  };
}

export function AutoGrowTextField({ value, onChange, placeholder, className, ariaLabel, style }: Omit<TextFieldProps, "align"> & { style?: CSSProperties }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const { lines, lineHeight, paddingHeight } = measureTextLayout(element, element.value);
    const maxHeight = lineHeight * 2 + paddingHeight;
    element.style.maxHeight = `${maxHeight}px`;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = lines > 2 ? "auto" : "hidden";
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.isComposing) return;
    const element = event.currentTarget;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const prefix = element.value.slice(0, start);
    const nextValue = `${prefix}\\n${element.value.slice(end)}`;

    // Enter is allowed only from visual line one, and only if the inserted
    // newline leaves the complete value within the two-line display limit.
    if (measureTextLayout(element, prefix).lines > 1 || measureTextLayout(element, nextValue).lines > 2) {
      event.preventDefault();
    }
  };

  useLayoutEffect(syncHeight, [syncHeight, value]);

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
      value={value}
      aria-label={ariaLabel}
      aria-describedby={`${ariaLabel.replace(/\\s+/g, "-").toLowerCase()}-limit`}
      placeholder={placeholder}
      title={value || undefined}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("editable w-full resize-none overflow-hidden border-0 bg-transparent p-0.5", className)}
      style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", overflowX: "hidden", lineHeight: "normal", ...style }}
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
