import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground shadow-brand hover:brightness-105 active:scale-[0.97]",
  secondary: "bg-secondary text-secondary-foreground hover:bg-black/10 active:scale-[0.97]",
  ghost: "bg-transparent text-foreground hover:bg-black/5 active:scale-[0.97]",
  danger: "bg-destructive text-destructive-foreground hover:brightness-110 active:scale-[0.97]",
  outline: "border border-border bg-surface text-foreground hover:bg-black/5 active:scale-[0.97]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-5 text-sm rounded-2xl",
  lg: "h-14 px-6 text-base rounded-2xl",
  icon: "h-11 w-11 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 select-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});
