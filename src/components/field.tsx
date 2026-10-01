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

/** Terms editor: one visible line initially; Enter reveals line 2, then line 3. */
export function TermsField({ value, onChange, placeholder, className, ariaLabel }: Omit<TextFieldProps, "align">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const getLineCount = (text: string) => Math.min(3, Math.max(1, (text.match(/\n/g)?.length ?? 0) + 1));

  const syncHeight = () => {
    const element = ref.current;
    if (!element) return;
    const lineCount = getLineCount(element.value);
    element.style.height = `${lineCount * 1.15}em`;
    element.style.minHeight = `${lineCount * 1.15}em`;
    element.style.maxHeight = `${lineCount * 1.15}em`;
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

  const lineCount = getLineCount(value);
  const lineHeight = "1.15em";

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
        height: `${lineCount * 1.15}em`,
        minHeight: `${lineCount * 1.15}em`,
        maxHeight: `${lineCount * 1.15}em`,
        lineHeight,
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
