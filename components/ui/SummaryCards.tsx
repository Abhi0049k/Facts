"use client";

import { CheckCircle, ArrowRight, Target, TrendingUp, TrendingDown } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface CompletionSummaryProps {
  userCompanyName: string;
  competitorCount: number;
  closestMatch?: { name: string; score: number };
  furthestMatch?: { name: string; score: number };
  sentimentEnabled: boolean;
  sentimentCoverage?: number;
  onOpenReport: () => void;
  className?: string;
}

export function CompletionSummary({
  userCompanyName,
  competitorCount,
  closestMatch,
  furthestMatch,
  sentimentEnabled,
  sentimentCoverage,
  onOpenReport,
  className,
}: CompletionSummaryProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white border border-verified/30 bg-verified-soft/50 p-6 shadow-soft animate-rise",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-verified flex-shrink-0" aria-hidden="true" />
            <h3 className="font-semibold text-ink">Analysis complete</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            {userCompanyName} analyzed against {competitorCount} competitor{competitorCount !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white border border-line p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Target className="h-4 w-4" aria-hidden="true" />
            <span>Closest match</span>
          </div>
          <div className="mt-1 font-semibold text-ink">
            {closestMatch?.name ?? "—"}
          </div>
          {closestMatch && (
            <div className="mt-0.5 text-xs text-verified font-medium">
              {Math.round(closestMatch.score * 100)}% overlap
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white border border-line p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
            <span>Furthest match</span>
          </div>
          <div className="mt-1 font-semibold text-ink">
            {furthestMatch?.name ?? "—"}
          </div>
          {furthestMatch && (
            <div className="mt-0.5 text-xs text-muted font-medium">
              {Math.round(furthestMatch.score * 100)}% overlap
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white border border-line p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <span>Competitors</span>
          </div>
          <div className="mt-1 font-semibold text-ink">{competitorCount}</div>
          <div className="mt-0.5 text-xs text-muted">Selected & profiled</div>
        </div>

        <div className="rounded-xl bg-white border border-line p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-4 w-4" aria-hidden="true">💬</span>
            <span>Sentiment</span>
          </div>
          <div className="mt-1 font-semibold text-ink">
            {sentimentEnabled
              ? sentimentCoverage !== undefined
                ? `${sentimentCoverage} / ${competitorCount} covered`
                : "Analyzed"
              : "Not enabled"}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {sentimentEnabled ? "Public review scan" : "Enable in options"}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Button
          size="lg"
          fullWidth={true}
          rightIcon={<ArrowRight className="h-4 w-4" />}
          onClick={onOpenReport}
        >
          Open full report
        </Button>
      </div>
    </div>
  );
}

interface InsightCalloutProps {
  title: string;
  children: ReactNode;
  variant?: "royal" | "verified" | "danger";
  className?: string;
}

export function InsightCallout({ title, children, variant = "royal", className }: InsightCalloutProps) {
  const variantStyles = {
    royal: "border-l-3 border-royal bg-royal-wash",
    verified: "border-l-3 border-verified bg-verified-soft",
    danger: "border-l-3 border-danger bg-[rgb(194,65,85,0.1)]",
  };

  const titleColors = {
    royal: "text-royal",
    verified: "text-verified",
    danger: "text-danger",
  };

  return (
    <div
      className={cn(
        "rounded-r-xl p-5",
        variantStyles[variant],
        className
      )}
      role="complementary"
    >
      <p className={cn("font-semibold", titleColors[variant])}>
        {title}
      </p>
      <div className="mt-2 text-sm text-ink-soft">
        {children}
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  className?: string;
}

export function MetricCard({ label, value, icon, trend, trendLabel, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white border border-line p-5 shadow-soft transition-shadow hover:shadow",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal-wash text-royal">
            {icon}
          </div>
        )}
      </div>
      {trend && trendLabel && (
        <div
          className={cn(
            "mt-3 flex items-center gap-1.5 text-xs font-medium",
            trend === "up" ? "text-verified" : trend === "down" ? "text-danger" : "text-muted"
          )}
        >
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}