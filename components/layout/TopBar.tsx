"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

interface TopBarProps {
  companyDomain?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  progressStep?: number;
  totalSteps?: number;
}

export function TopBar({
  companyDomain,
  showBack = false,
  onBack,
  actions,
  progressStep,
  totalSteps,
}: TopBarProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isResults = pathname?.startsWith("/results");

  const handleBack = () => {
    if (onBack) onBack();
    else window.history.back();
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-40",
        "h-16",
        "bg-white/80 backdrop-blur-md border-b border-line",
        "transition-all duration-200"
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Facts - Home">
            <span
              className="h-8 w-8 flex items-center justify-center rounded-full bg-royal"
              aria-hidden="true"
            >
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <span className="font-display font-semibold text-lg text-ink">Facts</span>
          </Link>

          {(isDashboard || isResults) && companyDomain && (
            <Badge variant="domain" className="hidden sm:inline-flex">
              {companyDomain}
            </Badge>
          )}

          {(isDashboard || isResults) && progressStep !== undefined && totalSteps !== undefined && (
            <div className="hidden md:flex items-center gap-1.5 ml-2 text-xs font-mono text-muted-light">
              <span>STEP</span>
              <span className="text-royal font-semibold">{progressStep}</span>
              <span className="text-line-strong">/</span>
              <span>{totalSteps}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={handleBack}
              aria-label="Back"
            >
              Back
            </Button>
          )}
          {actions}
        </div>
      </div>
    </nav>
  );
}