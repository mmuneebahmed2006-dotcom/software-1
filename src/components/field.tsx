import { useLayoutEffect, useRef } from "react";
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

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
  step?: number;
}

export function NumberField({ value, onChange, ariaLabel, className, step = 1 }: NumberFieldProps) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      value={Number.isFinite(value) ? value : ""}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className={cn("editable w-full border-0 bg-transparent p-0.5 text-right tabular-nums", className)}
    />
  );
}