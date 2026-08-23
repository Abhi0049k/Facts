"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { AppProvider } from "@/components/providers/AppProvider";
import { PipelineProvider } from "@/components/providers/PipelineProvider";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>
        <PipelineProvider>
          {children}
        </PipelineProvider>
      </ToastProvider>
    </AppProvider>
  );
}