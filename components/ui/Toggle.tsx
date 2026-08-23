"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ToggleProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className, id, ...props }, ref) => {
    const toggleId = id || `toggle-${Math.random().toString(36).slice(2)}`;

    return (
      <label className={cn("flex items-start gap-3 cursor-pointer", className)}>
        <div className="relative flex h-6 w-11 shrink-0 items-center rounded-full bg-line transition-colors duration-150 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-royal peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white">
          <input
            ref={ref}
            type="checkbox"
            className="peer h-6 w-11 appearance-none cursor-pointer rounded-full bg-transparent checked:bg-royal"
            id={toggleId}
            {...props}
          />
          <span
            className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-full"
            aria-hidden="true"
          />
        </div>
        <div className="pt-0.5">
          {label && (
            <span className="text-sm font-medium text-ink">{label}</span>
          )}
          {description && (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          )}
        </div>
      </label>
    );
  }
);

Toggle.displayName = "Toggle";