"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PipelineProgress, stageNumberFromName } from "@/components/PipelineProgress";
import { SiteHeader } from "@/components/SiteHeader";
import { readAnalyzeStream } from "@/lib/client/read-analyze-stream";
import type { AnalyzeResponse } from "@/lib/types";

const autoStartedKeys = new Set<string>();

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFromQuery = searchParams.get("url")?.trim() ?? "";
  const sentimentFromQuery = searchParams.get("sentiment") === "1";

  const [companyUrl, setCompanyUrl] = useState(urlFromQuery);
  const [includeSentiment, setIncludeSentiment] = useState(sentimentFromQuery);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  async function runAnalysis(nextUrl: string, nextSentiment: boolean) {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    setError(null);
    setFailedStage(null);
    setIsRunning(true);
    setCurrentStage(1);
    setCompletedStages([]);
    setStatusMessage("Starting pipeline...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ companyUrl: nextUrl, includeSentiment: nextSentiment })
      });

      if (!response.ok && !response.body) {
        throw new Error("Could not start analysis. Confirm npm run dev is still running.");
      }

      if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Analysis failed");
      }

      let finished: AnalyzeResponse | null = null;
      let streamError: string | null = null;

      await readAnalyzeStream(response, (event) => {
        if (event.type === "stage") {
          setCurrentStage(event.stage);
          setStatusMessage(event.message);
          if (event.status === "complete") {
            setCompletedStages((stages) =>
              stages.includes(event.stage) ? stages : [...stages, event.stage]
            );
          }
          return;
        }

        if (event.type === "error") {
          setCompletedStages(event.completedStages);
          const failed = stageNumberFromName(event.failedStage);
          setFailedStage(failed);
          setCurrentStage(failed ?? event.completedStages.at(-1) ?? 1);
          setStatusMessage(null);
          streamError = event.error;
          return;
        }

        if (event.type === "done") {
          finished = {
            runId: event.runId,
            state: event.state,
            completedStages: event.completedStages
          };
          setCompletedStages(event.completedStages);
          setCurrentStage(nextSentiment ? 8 : 7);
          setStatusMessage("Analysis complete");
        }
      });

      if (streamError) {
        throw new Error(streamError);
      }

      if (!finished) {
        throw new Error(
          "Connection closed before the pipeline finished. Keep npm run dev running. A long scrape can take a few minutes."
        );
      }

      window.localStorage.setItem("facts:last-analysis", JSON.stringify(finished));
      router.push("/results");
    } catch (analysisError) {
      const message =
        analysisError instanceof TypeError && analysisError.message === "Failed to fetch"
          ? "Lost connection to the local server. Restart npm run dev and try again. Do not stop the terminal while analysis is running."
          : analysisError instanceof Error
            ? analysisError.message
            : "Analysis failed";
      setError(message);
      setStatusMessage(null);
      setIsRunning(false);
      runningRef.current = false;
    }
  }

  useEffect(() => {
    setCompanyUrl(urlFromQuery);
    setIncludeSentiment(sentimentFromQuery);
    if (!urlFromQuery) {
      return;
    }
    const key = `${urlFromQuery}|${sentimentFromQuery ? "1" : "0"}`;
    if (autoStartedKeys.has(key)) {
      return;
    }
    autoStartedKeys.add(key);
    void runAnalysis(urlFromQuery, sentimentFromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFromQuery, sentimentFromQuery]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = companyUrl.trim();
    if (!trimmed) {
      setError("Paste a company homepage first.");
      return;
    }
    void runAnalysis(trimmed, includeSentiment);
  }

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <SiteHeader compact />

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 pt-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <section className="rounded-xl border border-line bg-panel p-6 shadow-panel">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            The pipeline runs here. Stages complete live as scrape and model work finishes.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
              {error}
            </div>
          ) : null}

          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="company-url">
                Company URL
              </label>
              <input
                className="h-11 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                disabled={isRunning}
                id="company-url"
                onChange={(event) => setCompanyUrl(event.target.value)}
                placeholder="company.com"
                type="text"
                value={companyUrl}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
              <input
                checked={includeSentiment}
                className="h-4 w-4 accent-accent"
                disabled={isRunning}
                onChange={(event) => setIncludeSentiment(event.target.checked)}
                type="checkbox"
              />
              Include public-review sentiment
            </label>

            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#236b5b] px-4 text-sm font-semibold text-[#f3f4ee] transition hover:bg-[#1a5246] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
              disabled={isRunning || !companyUrl.trim()}
              type="submit"
            >
              {isRunning ? "Running analysis..." : "Analyze company"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-line bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-semibold">Pipeline</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Each stage returns JSON the next stage can trust. Cost stays visible because the
              sequence is fixed.
            </p>
            {statusMessage ? <p className="mt-3 text-sm font-medium text-amber">{statusMessage}</p> : null}
          </div>

          <PipelineProgress
            completedStages={completedStages}
            currentStage={currentStage}
            failedStage={failedStage}
            includeSentiment={includeSentiment}
          />
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-paper text-ink">
          <SiteHeader compact />
          <p className="px-5 py-10 text-sm text-muted">Loading dashboard...</p>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
