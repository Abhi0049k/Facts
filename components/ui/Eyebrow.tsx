"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: ReactNode;
  step?: { current: number; total: number };
  className?: string;
}

export function Eyebrow({ children, step, className }: EyebrowProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-medium mb-6", className)}>
      <span className="w-5.5 h-px bg-royal rounded" aria-hidden="true" />
      <span className="text-royal">{children}</span>
      {step && (
        <span className="text-muted-light">{step.current} / {step.total}</span>
      )}
    </div>
  );
}