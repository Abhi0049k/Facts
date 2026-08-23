"use client";

import { Check, Loader2, AlertCircle, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

const statusStyles = {
  pending: "border-line bg-white text-muted-light",
  active: "border-royal bg-royal-wash text-royal",
  complete: "border-verified bg-verified-soft text-verified",
  error: "border-danger bg-[rgb(194,65,85,0.1)] text-danger",
};

interface StageRowProps {
  number: number;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  description?: string;
  children?: ReactNode;
  expandable?: boolean;
  duration?: number;
  result?: string;
  chips?: string[];
}

export function StageRow({
  number,
  label,
  status,
  description,
  children,
  expandable = false,
  duration,
  result,
  chips,
}: StageRowProps) {
  const [expanded, setExpanded] = useState(false);

  const iconMap = {
    pending: <span className="font-mono text-xs">{number}</span>,
    active: <Loader2 className="h-4 w-4 animate-spin animate-pulse-soft" />,
    complete: <Check className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
  };

  const renderResult = () => {
    if (!result && !chips && !children) return null;
    
    return (
      <div className="mt-2 ml-14 max-h-0 overflow-hidden transition-all duration-300 ease-out">
        {expanded && (
          <div className="max-h-60 overflow-y-auto pt-2 pb-4 border-l-2 border-royal-soft pl-4">
            {result && (
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{result}</p>
            )}
            {chips && chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span key={chip} className="mini-chip">
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="group border-t border-line first:border-t-0">
      <button
        type="button"
        className={cn(
          "flex items-center gap-4 w-full px-5 py-4 rounded-xl border-2 transition-all duration-200",
          "hover:border-royal/50 hover:bg-royal-wash/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
          statusStyles[status]
        )}
        onClick={() => expandable && setExpanded(!expanded)}
        aria-expanded={expanded}
        disabled={!expandable}
      >
        <div
          className={cn(
            "flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold",
            statusStyles[status]
          )}
          aria-hidden="true"
        >
          {iconMap[status]}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-medium">{label}</span>
            {description && <span className="text-sm text-muted-light">{description}</span>}
          </div>
          {duration && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-light">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>{duration}s</span>
            </div>
          )}
        </div>

        {expandable && (
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-light transition-transform duration-200",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {result && (
        <div className="mt-2 ml-14 max-h-0 overflow-hidden transition-all duration-300 ease-out">
          <div className="max-h-60 overflow-y-auto pt-2 pb-4 border-l-2 border-royal-soft pl-4">
            <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{result}</p>
          </div>
        </div>
      )}
      {chips && chips.length > 0 && (
        <div className="mt-2 ml-14 max-h-0 overflow-hidden transition-all duration-300 ease-out">
          <div className="max-h-60 overflow-y-auto pt-2 pb-4 border-l-2 border-royal-soft pl-4">
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip} className="mini-chip">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function StageRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-line bg-white">
      <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white" />
      <div className="flex-1">
        <div className="h-4 w-3/4 bg-line/50 rounded animate-pulse" />
        <div className="mt-2 h-3 w-1/2 bg-line/50 rounded animate-pulse" />
      </div>
    </div>
  );
}