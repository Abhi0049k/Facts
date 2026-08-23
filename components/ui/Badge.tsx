"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "royal" | "verified" | "danger" | "domain" | "mini";
  className?: string;
  asChild?: boolean;
}

export function Badge({
  children,
  variant = "default",
  className,
  asChild = false,
}: BadgeProps) {
  const variantStyles = {
    default: "bg-surface-alt text-ink-soft border border-line",
    royal: "bg-royal-soft text-royal border border-royal/30",
    verified: "bg-verified-soft text-verified border border-verified/30",
    danger: "bg-[rgb(194,65,85,0.1)] text-danger border border-danger/30",
    domain: "bg-white text-ink border border-line shadow-soft",
    mini: "font-mono text-[10px] bg-royal-wash border border-line px-2.5 py-1 rounded-full text-ink-soft",
  };

  const baseStyles = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium";

  if (asChild) {
    return (
      <span className={cn(baseStyles, variantStyles[variant], className)}>
        {children}
      </span>
    );
  }

  return (
    <span className={cn(baseStyles, variantStyles[variant], className)}>
      {children}
    </span>
  );
}