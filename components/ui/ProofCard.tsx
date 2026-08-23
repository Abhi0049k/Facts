"use client";

import { CheckCircle, Target, Shield } from "lucide-react";
import { type ReactNode } from "react";

const proofItems = [
  { icon: CheckCircle, label: "Verified public sources", desc: "Live scraped pages, not cached summaries" },
  { icon: Target, label: "Structured market signals", desc: "Funding, headcount, revenue, founded year" },
  { icon: Shield, label: "Report-ready output", desc: "Comparison table, insights, exportable PDF" },
];

export function ProofCard({ className }: { className?: string }) {
  return (
    <aside className="relative w-full max-w-xs lg:max-w-[235px] lg:sticky lg:top-24 animate-rise" aria-label="What Facts delivers">
      <div className="text-center mb-6">
        <div className="flex items-center gap-2 justify-center text-xs font-mono uppercase tracking-wider font-medium text-royal mb-4">
          <span className="w-5.5 h-px bg-royal rounded" aria-hidden="true" />
          <span>One run delivers</span>
        </div>
        <strong className="block font-display text-4xl text-royal tracking-tight">3 → 1</strong>
        <p className="mt-2 text-sm text-muted">Three relevant competitors distilled into one clear comparison.</p>
      </div>
      <div className="border-t border-line pt-4 space-y-4">
        {proofItems.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-royal-wash text-royal">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-ink">{label}</p>
              <p className="text-xs text-muted">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}