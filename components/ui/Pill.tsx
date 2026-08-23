"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PillProps {
  children: ReactNode;
  variant?: "default" | "royal" | "verified" | "danger" | "domain";
  className?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onClick?: () => void;
}

export function Pill({
  children,
  variant = "default",
  className,
  leftIcon,
  rightIcon,
  onClick,
}: PillProps) {
  const variantStyles = {
    default: "bg-surface-alt text-ink-soft border border-line",
    royal: "bg-royal-soft text-royal border border-royal/30",
    verified: "bg-verified-soft text-verified border border-verified/30",
    danger: "bg-[rgb(194,65,85,0.1)] text-danger border border-danger/30",
    domain: "bg-white text-ink border border-line shadow-soft",
  };

  const Component = onClick ? "button" : "span";

  return (
    <Component
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
        "transition-colors duration-150",
        variantStyles[variant],
        onClick && "hover:bg-opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
        className
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
      {children}
      {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </Component>
  );
}