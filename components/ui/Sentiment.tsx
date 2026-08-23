"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SentimentRowProps {
  name: string;
  score?: string;
  children?: ReactNode;
  className?: string;
}

export function SentimentRow({ name, score, children, className }: SentimentRowProps) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex justify-between mb-1.5 text-sm">
        <span className="font-semibold text-ink">{name}</span>
        {score && (
          <span className="font-mono text-muted text-xs">{score}</span>
        )}
      </div>
      <div className="h-2 bg-royal-soft rounded-full overflow-hidden">
        {score && (
          <div
            className="h-full bg-royal rounded-full transition-all duration-500"
            style={{ width: score.split(" ")[0] + "%" }}
          />
        )}
        {!score && children}
      </div>
      {children && !score && (
        <p className="mt-2 text-sm text-muted italic">{children}</p>
      )}
    </div>
  );
}

interface SentimentGridProps {
  children: ReactNode;
  className?: string;
}

export function SentimentGrid({ children, className }: SentimentGridProps) {
  return (
    <div className={cn("grid gap-8 lg:grid-cols-[1fr_220px] items-start", className)}>
      {children}
    </div>
  );
}

interface ReportAsideProps {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function ReportAside({ label, value, description, className }: ReportAsideProps) {
  return (
    <aside className={cn("p-4 bg-white border border-line rounded-2xl shadow-soft", className)}>
      <span className="font-mono text-xs text-muted uppercase tracking-wider block">
        {label}
      </span>
      <strong className="block mt-1 font-display text-2xl text-royal">
        {value}
      </strong>
      {description && (
        <p className="mt-2 text-xs text-muted leading-relaxed">{description}</p>
      )}
    </aside>
  );
}

interface SentimentNoneProps {
  children: ReactNode;
  className?: string;
}

export function SentimentNone({ children, className }: SentimentNoneProps) {
  return (
    <p className={cn("text-sm text-muted italic", className)}>
      {children}
    </p>
  );
}