"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
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
      <div className="min-h-[100dvh] bg-paper">
        <SiteHeader compact />
        <main className="mx-auto flex max-w-4xl items-center justify-center px-5 py-16">
          <div className="rounded-xl border border-line bg-panel p-8 text-center shadow-panel">
            <h1 className="text-xl font-semibold text-ink">No analysis found</h1>
            <p className="mt-2 text-sm text-muted">Paste a company URL on the home page to run a briefing.</p>
            <Link
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#236b5b] px-4 py-2.5 text-sm font-semibold text-[#f3f4ee] transition hover:bg-[#1a5246]"
              href="/"
            >
              <ArrowLeft className="h-4 w-4" />
              New briefing
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-paper">
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-7xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Intelligence report</h1>
          <p className="mt-1 text-sm text-muted">
            {companies.length} companies compared across offerings, public stats, and market gaps.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold text-ink shadow-panel transition hover:bg-paper active:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCw className="h-4 w-4 text-neutral-500" />
          Refresh Report
        </button>
      </header>

      <section className="grid gap-6 py-6 xl:grid-cols-[1.1fr_2fr]">
        <CompanyCard company={state.userCompany} featured />
        <div className="grid gap-4 md:grid-cols-2">
          {state.competitorProfiles.map((company) => (
            <CompanyCard company={company} key={company.domain} />
          ))}
        </div>
      </section>

      <section className="space-y-6 pb-6">
        <ComparisonChart comparison={comparison} />
        <ServicesMatrix comparison={comparison} />
        <ComparisonTable comparison={comparison} />
      </section>

      {sentiment ? <SentimentSection sentiment={sentiment} /> : null}
    </main>
    </div>
  );
}

function SentimentSection({ sentiment }: { sentiment: SentimentResult[] }) {
  return (
    <section className="pb-8">
      <div className="rounded-2xl border border-line bg-panel shadow-panel">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-semibold text-ink">Public sentiment and reviews</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Optional review-source search and LLM sentiment scoring.
          </p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {sentiment.map((item) => (
            <article className="rounded-xl border border-line bg-paper p-5" key={item.companyName}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{item.companyName}</h3>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    item.dataAvailable
                      ? "bg-[#236b5b] text-[#f3f4ee]"
                      : "border border-line bg-panel text-muted"
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
