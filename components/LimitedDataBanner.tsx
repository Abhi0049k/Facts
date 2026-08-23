"use client";

import { useState } from "react";
import { AlertCircle, X } from "lucide-react";

export function LimitedDataBanner() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm leading-6 text-ink">
          We don&apos;t have pre-verified data sources for this company yet. Results below are based on live
          discovery and may be less complete.
        </p>
      </div>
      <button
        className="shrink-0 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline flex items-center gap-1"
        onClick={() => setOpen(false)}
        type="button"
        aria-label="Dismiss"
      >
        Dismiss
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}