import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-end sm:place-items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-lg bg-surface shadow-lift",
          "rounded-t-3xl sm:rounded-3xl",
          "animate-in slide-in-from-bottom-6 sm:zoom-in-95 sm:slide-in-from-bottom-0 duration-200",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-black/5"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
