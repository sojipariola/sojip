import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";

interface SOJIPButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const SOJIPButton = forwardRef<HTMLButtonElement, SOJIPButtonProps>(
  ({ variant = "primary", loading, className, children, disabled, ...rest }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm";
    const variants: Record<Variant, string> = {
      primary: "bg-terracotta-600 text-white hover:bg-terracotta-700",
      secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
      ghost: "text-slate-600 hover:bg-slate-100",
    };
    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);

SOJIPButton.displayName = "SOJIPButton";
