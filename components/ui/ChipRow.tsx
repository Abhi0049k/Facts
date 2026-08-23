"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChipRowProps {
  children: ReactNode;
  className?: string;
}

export function ChipRow({ children, className }: ChipRowProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 mt-3", className)}>
      {children}
    </div>
  );
}

interface MiniChipProps {
  children: ReactNode;
  className?: string;
}

export function MiniChip({ children, className }: MiniChipProps) {
  return (
    <span className={cn("mini-chip font-mono text-[10px] bg-royal-wash border border-line px-2.5 py-1 rounded-full text-ink-soft", className)}>
      {children}
    </span>
  );
}