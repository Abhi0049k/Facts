"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn("border border-line rounded-2xl bg-white overflow-auto shadow-soft", className)}>
      <table className="min-w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

interface TheadProps {
  children: ReactNode;
  className?: string;
}

export function Thead({ children, className }: TheadProps) {
  return (
    <thead className={cn("bg-surface-alt border-b border-line", className)}>
      {children}
    </thead>
  );
}

interface ThProps {
  children: ReactNode;
  className?: string;
  scope?: "col" | "row";
}

export function Th({ children, className, scope = "col" }: ThProps) {
  return (
    <th
      scope={scope}
      className={cn(
        "text-left font-mono text-xs uppercase tracking-wider text-muted",
        "px-3.5 py-3 font-semibold border-b border-line",
        className
      )}
    >
      {children}
    </th>
  );
}

interface TbodyProps {
  children: ReactNode;
  className?: string;
}

export function Tbody({ children, className }: TbodyProps) {
  return (
    <tbody className={cn("divide-y divide-line", className)}>
      {children}
    </tbody>
  );
}

interface TrProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Tr({ children, className, hover = true }: TrProps) {
  return (
    <tr className={cn("align-top transition-colors", hover && "hover:bg-surface-alt/50", className)}>
      {children}
    </tr>
  );
}

interface TdProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "metric" | "hi";
}

export function Td({ children, className, variant = "default" }: TdProps) {
  const variantStyles = {
    default: "px-3.5 py-3.5 text-ink-soft",
    metric: "px-3.5 py-3.5 text-muted font-mono text-xs whitespace-nowrap",
    hi: "px-3.5 py-3.5 text-royal font-bold font-mono text-xs whitespace-nowrap",
  };

  return (
    <td className={cn(variantStyles[variant], className)}>
      {children}
    </td>
  );
}

interface CiteProps {
  children: ReactNode;
  className?: string;
}

export function Cite({ children, className }: CiteProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs",
        "text-verified border border-[#bce6db] bg-verified-soft px-2 py-1 rounded-full",
        className
      )}
    >
      <span aria-hidden="true">✓</span>
      {children}
    </span>
  );
}