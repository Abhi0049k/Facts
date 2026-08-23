"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TopBar } from "./TopBar";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

export function PageShell({ children, className, wide = false }: PageShellProps) {
  return (
    <div className={cn("min-h-screen bg-royal-wash", className)}>
      <TopBar />
      <main className={cn("pt-20 pb-16 px-5", wide ? "max-w-7xl" : "max-w-3xl", "mx-auto")}>
        <div className="animate-page-in">{children}</div>
      </main>
    </div>
  );
}

export function PageShellNoTopBar({ children, className, wide = false }: PageShellProps) {
  return (
    <div className={cn("min-h-screen bg-royal-wash", className)}>
      <main className={cn("pt-20 pb-16 px-5", wide ? "max-w-7xl" : "max-w-3xl", "mx-auto")}>
        <div className="animate-page-in">{children}</div>
      </main>
    </div>
  );
}