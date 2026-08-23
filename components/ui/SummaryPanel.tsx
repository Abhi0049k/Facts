"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SummaryMiniRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function SummaryMiniRow({ label, value, className }: SummaryMiniRowProps) {
  return (
    <div className={cn("flex justify-between gap-4 py-3 border-t border-line text-sm", className)}>
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

interface SummaryPanelProps {
  title: string;
  children: ReactNode;
  cta?: ReactNode;
  className?: string;
  visible?: boolean;
}

export function SummaryPanel({ title, children, cta, className, visible = true }: SummaryPanelProps) {
  return (
    <div
      className={cn(
        "mt-6 rounded-2xl border border-line-strong bg-white p-6 shadow transition-all duration-500 ease-out",
        "opacity-0 translate-y-2",
        visible && "opacity-100 translate-y-0",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <h3 className="font-display font-semibold text-lg text-ink mb-4">{title}</h3>
      <div className="space-y-0">{children}</div>
      {cta && (
        <div className="mt-6 flex justify-end">
          {cta}
        </div>
      )}
    </div>
  );
}