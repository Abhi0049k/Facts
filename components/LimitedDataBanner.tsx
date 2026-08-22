"use client";

import { useState } from "react";

export function LimitedDataBanner() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
      <p className="text-sm leading-6 text-ink">
        We don't have pre-verified data sources for this company yet. Results below are based on live
        discovery and may be less complete.
      </p>
      <button
        className="shrink-0 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
        onClick={() => setOpen(false)}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
