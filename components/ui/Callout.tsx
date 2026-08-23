"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  children: ReactNode;
  variant?: "royal" | "verified" | "danger";
  className?: string;
}

export function Callout({ children, variant = "royal", className }: CalloutProps) {
  const variantStyles = {
    royal: "border-l-3 border-royal bg-royal-soft",
    verified: "border-l-3 border-verified bg-verified-soft",
    danger: "border-l-3 border-danger bg-[rgb(194,65,85,0.1)]",
  };

  return (
    <div
      className={cn(
        "rounded-r-xl p-4 text-sm text-ink-soft mt-4",
        variantStyles[variant],
        className
      )}
      role="complementary"
    >
      {children}
    </div>
  );
}