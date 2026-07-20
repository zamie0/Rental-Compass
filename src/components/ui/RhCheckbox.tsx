import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { box: "size-5", icon: 12 },
  md: { box: "size-6", icon: 14 },
  lg: { box: "size-8", icon: 18 },
};

export function Checkbox({ checked, onChange, label, size = "md", className }: Props) {
  const s = sizes[size];
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 group select-none", className)}>
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
        className={cn(
          s.box,
          "grid shrink-0 place-items-center rounded-lg border-2 transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          checked
            ? "border-brand bg-brand scale-100"
            : "border-black/15 bg-surface group-hover:border-brand/40 group-active:scale-95",
        )}
      >
        <Check
          size={s.icon}
          strokeWidth={3.5}
          className={cn(
            "text-brand-foreground transition-all duration-200",
            checked ? "opacity-100 scale-100" : "opacity-0 scale-50",
          )}
        />
      </span>
      {label && (
        <span
          className={cn(
            "text-sm transition-all duration-200",
            checked ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {label}
        </span>
      )}
    </label>
  );
}
