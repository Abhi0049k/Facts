"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { CompanyCard } from "@/components/CompanyCard";
import { ComparisonChart, ServicesMatrix } from "@/components/ComparisonChart";
import { ComparisonTable } from "@/components/ComparisonTable";
import type { AnalyzeResponse, SentimentResult } from "@/lib/types";

export default function ResultsPage() {
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("facts:last-analysis");
    if (stored) {
      setAnalysis(JSON.parse(stored) as AnalyzeResponse);
    }
  }, []);

  const state = analysis?.state;
  const comparison = state?.comparison;
  const sentiment = state?.sentiment;
  const companies = useMemo(
    () => (state?.userCompany ? [state.userCompany, ...state.competitorProfiles] : []),
    [state]
  );

  if (!state || !comparison || !state.userCompany) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-5">
        <div className="rounded-md border border-line bg-panel p-6 text-center shadow-panel">
          <h1 className="text-xl font-semibold text-ink">No analysis found</h1>
          <p className="mt-2 text-sm text-neutral-600">Run a company analysis to populate the dashboard.</p>
          <Link
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            New analysis
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-accent" href="/">
            <ArrowLeft className="h-4 w-4" />
            New analysis
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Facts report</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {companies.length} companies compared across offerings, public stats, and market gaps.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink shadow-panel transition hover:bg-paper"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <section className="grid gap-4 py-6 xl:grid-cols-[1.1fr_2fr]">
        <CompanyCard company={state.userCompany} featured />
        <div className="grid gap-4 md:grid-cols-2">
          {state.competitorProfiles.map((company) => (
            <CompanyCard company={company} key={company.domain} />
          ))}
        </div>
      </section>

      <section className="space-y-4 pb-6">
        <ComparisonChart comparison={comparison} />
        <ServicesMatrix comparison={comparison} />
        <ComparisonTable comparison={comparison} />
      </section>

      {sentiment ? <SentimentSection sentiment={sentiment} /> : null}
    </main>
  );
}

function SentimentSection({ sentiment }: { sentiment: SentimentResult[] }) {
  return (
    <section className="pb-8">
      <div className="rounded-md border border-line bg-panel shadow-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-semibold text-ink">Public sentiment</h2>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {sentiment.map((item) => (
            <article className="rounded-md border border-line bg-paper p-4" key={item.companyName}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{item.companyName}</h3>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    item.dataAvailable ? "bg-accent text-white" : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {item.dataAvailable && item.sentimentScore !== undefined
                    ? `${item.sentimentScore}/100`
                    : "Insufficient data"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-700">{item.summary}</p>
              {item.sourcesUsed.length ? (
                <div className="mt-3 text-xs text-neutral-500">
                  Sources: {item.sourcesUsed.slice(0, 3).join(", ")}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
