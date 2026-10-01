import { useLayoutEffect, useRef, type CSSProperties } from "react";
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

/** One-line-at-a-time editor: shows a single line; Enter shifts the view to the next line. */
export function TermsField({ value, onChange, placeholder, className, ariaLabel }: Omit<TextFieldProps, "align">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncScroll = () => {
    const element = ref.current;
    if (!element) return;
    const caret = element.selectionStart ?? element.value.length;
    const line = element.value.slice(0, caret).split("\n").length - 1;
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || element.clientHeight;
    element.scrollTop = line * lineHeight;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      const lineCount = (event.currentTarget.value.match(/\n/g)?.length ?? 0) + 1;
      if (lineCount >= 3) {
        event.preventDefault();
        return;
      }
    }
    requestAnimationFrame(syncScroll);
  };

  useLayoutEffect(syncScroll, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onKeyUp={syncScroll}
      onClick={syncScroll}
      className={cn("editable w-full resize-none overflow-hidden border-0 bg-transparent p-0.5 leading-snug", className)}
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
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={Number.isFinite(value) ? value : ""}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className={cn("editable w-full border-0 bg-transparent p-0.5 text-right tabular-nums", className)}
      style={style}
    />
  );
}
