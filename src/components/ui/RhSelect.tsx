import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  dotColor?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function Select({ value, options, onChange, className, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-surface text-left font-semibold transition-all hover:border-brand/40 focus:outline-none focus:ring-4 focus:ring-brand/10",
          size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {current?.dotColor && (
            <span className="size-2 shrink-0 rounded-full" style={{ background: current.dotColor }} />
          )}
          <span className="truncate">{current?.label ?? "Select…"}</span>
        </span>
        <ChevronDown size={16} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full origin-top overflow-hidden rounded-2xl border border-border bg-surface shadow-lift animate-in fade-in-0 zoom-in-95 duration-150">
          <ul className="max-h-72 overflow-y-auto p-1">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition-colors",
                      active ? "bg-brand-soft text-foreground" : "hover:bg-black/5",
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {opt.dotColor && (
                        <span className="size-2 shrink-0 rounded-full" style={{ background: opt.dotColor }} />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {active && <Check size={14} className="text-brand" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
