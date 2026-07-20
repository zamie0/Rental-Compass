import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldProps { label?: string; hint?: string; error?: string; }

const base =
  "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, hint, error, className, id, ...rest }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </label>
        )}
        <input ref={ref} id={inputId} className={cn(base, error && "border-destructive focus:border-destructive focus:ring-destructive/10", className)} {...rest} />
        {(hint || error) && (
          <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{error || hint}</p>
        )}
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, hint, error, className, id, ...rest }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </label>
        )}
        <textarea ref={ref} id={inputId} className={cn(base, "min-h-24 resize-y", error && "border-destructive", className)} {...rest} />
        {(hint || error) && (
          <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{error || hint}</p>
        )}
      </div>
    );
  },
);
