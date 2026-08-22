"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Globe2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PipelineProgress, stageNumberFromName } from "@/components/PipelineProgress";
import type { AnalyzeErrorResponse, AnalyzeResponse } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [companyUrl, setCompanyUrl] = useState("");
  const [includeSentiment, setIncludeSentiment] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFailedStage(null);
    setIsRunning(true);
    setCurrentStage(1);
    setCompletedStages([]);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyUrl, includeSentiment })
      });

      const payload = (await response.json()) as AnalyzeResponse & AnalyzeErrorResponse;

      if (!response.ok) {
        setCompletedStages(payload.completedStages ?? []);
        const failed = stageNumberFromName(payload.failedStage);
        setFailedStage(failed);
        setCurrentStage(failed ?? 1);
        throw new Error(payload.error ?? "Analysis failed");
      }

      window.localStorage.setItem("facts:last-analysis", JSON.stringify(payload));
      setCompletedStages(payload.completedStages);
      setCurrentStage(includeSentiment ? 8 : 7);
      router.push("/results");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed");
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="text-sm font-semibold uppercase text-accent">Facts</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Competitor intelligence grounded in real data
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-neutral-600 shadow-panel">
          <BarChart3 className="h-4 w-4 text-accent" />
          Fixed 8-stage pipeline
        </div>
      </header>

      <section className="grid flex-1 gap-6 py-8 lg:grid-cols-[420px_1fr]">
        <form
          className="h-fit rounded-md border border-line bg-panel p-5 shadow-panel"
          onSubmit={runAnalysis}
        >
          <label className="text-sm font-semibold text-ink" htmlFor="company-url">
            Company URL
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
            <Globe2 className="h-4 w-4 text-neutral-500" />
            <input
              className="w-full border-0 bg-transparent text-sm text-ink outline-none"
              id="company-url"
              onChange={(event) => setCompanyUrl(event.target.value)}
              placeholder="company.com or https://company.com"
              type="text"
              value={companyUrl}
            />
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-line bg-paper px-3 py-3">
            <span>
              <span className="block text-sm font-medium text-ink">Include sentiment analysis</span>
              <span className="block text-xs text-neutral-500">
                Runs optional review-source search after comparison.
              </span>
            </span>
            <input
              checked={includeSentiment}
              className="h-5 w-5 accent-accent"
              onChange={(event) => setIncludeSentiment(event.target.checked)}
              type="checkbox"
            />
          </label>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d594c] active:bg-[#16443a] disabled:cursor-not-allowed disabled:bg-neutral-300"
            disabled={isRunning || !companyUrl}
            type="submit"
          >
            {isRunning ? "Running analysis" : "Analyze company"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="space-y-5">
          <div className="rounded-md border border-line bg-panel p-5 shadow-panel">
            <h2 className="text-lg font-semibold text-ink">Pipeline status</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">
              Each stage takes a defined input, returns structured JSON, and writes to a shared
              pipeline state. The sequence is fixed for predictable cost and behavior.
            </p>
          </div>
          <PipelineProgress
            completedStages={completedStages}
            currentStage={currentStage}
            failedStage={failedStage}
            includeSentiment={includeSentiment}
          />
        </div>
      </section>
    </main>
  );
}
