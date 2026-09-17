import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "default" | "icon";
};

export function Button({ className, variant = "primary", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-[6px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        size === "icon" ? "size-8" : "h-9 px-3.5 text-xs",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/88",
        variant === "ghost" && "text-toolbar-foreground hover:bg-toolbar-muted",
        variant === "danger" && "text-destructive hover:bg-destructive-soft",
        className,
      )}
      {...props}
    />
  );
}