import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ open, onClose, title, description, children, className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-end sm:place-items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-lg bg-surface shadow-lift",
          "rounded-t-3xl sm:rounded-3xl",
          "animate-in slide-in-from-bottom-8 sm:zoom-in-95 sm:slide-in-from-bottom-0 duration-300",
          className,
        )}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-black/10" />
        </div>
        {(title || description) && (
          <div className="px-6 pb-2 pt-4 sm:pt-6">
            {title && <h3 className="text-lg font-bold tracking-tight">{title}</h3>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        <div className="px-6 pb-8 pt-2 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}
