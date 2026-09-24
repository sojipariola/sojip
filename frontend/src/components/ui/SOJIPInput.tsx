import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface SOJIPInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const SOJIPInput = forwardRef<HTMLInputElement, SOJIPInputProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full px-3.5 py-2.5 rounded-lg border bg-white",
            "text-slate-900 placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500",
            "transition",
            error ? "border-red-400" : "border-slate-300",
            className
          )}
          {...rest}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

SOJIPInput.displayName = "SOJIPInput";
