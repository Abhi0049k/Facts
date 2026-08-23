"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PipelineProgress, stageNumberFromName } from "@/components/PipelineProgress";
import { SiteHeader } from "@/components/SiteHeader";
import { LimitedDataBanner } from "@/components/LimitedDataBanner";
import { StageOutputList } from "@/components/StageOutputList";
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
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [haltMessage, setHaltMessage] = useState<string | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [stageOutputs, setStageOutputs] = useState<Array<{ stage: number; title: string; payload?: unknown }>>(
    []
  );
  const [databaseMatch, setDatabaseMatch] = useState<boolean | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!urlFromQuery) {
      router.replace("/");
    }
  }, [router, urlFromQuery]);

  async function runAnalysis(nextUrl: string, nextSentiment: boolean) {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    setError(null);
    setHaltMessage(null);
    setReportReady(false);
    setFailedStage(null);
    setIsRunning(true);
    setCurrentStage(0);
    setCompletedStages([]);
    setStageOutputs([]);
    setNotices([]);
    setDatabaseMatch(null);
    setStatusMessage("Checking the company database...");

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
      let halted = false;

      await readAnalyzeStream(response, (event) => {
        if (event.type === "stage") {
          if (event.status === "retry") {
            setStatusMessage(event.message);
            setNotices((current) =>
              current.includes(event.message) ? current : [...current, event.message]
            );
            if (event.stage > 0) {
              setCurrentStage(event.stage);
            }
            return;
          }
          setCurrentStage(event.stage);
          setStatusMessage(event.message);
          if (event.status === "complete") {
            setCompletedStages((stages) =>
              stages.includes(event.stage) ? stages : [...stages, event.stage]
            );
            setStageOutputs((current) => [
              ...current.filter((item) => item.stage !== event.stage),
              { stage: event.stage, title: event.message, payload: event.payload }
            ]);
            if (event.stage === 0 && event.payload && typeof event.payload === "object") {
              const payload = event.payload as { databaseMatch?: boolean };
              if (typeof payload.databaseMatch === "boolean") {
                setDatabaseMatch(payload.databaseMatch);
              }
            }
          }
          return;
        }

        if (event.type === "halted") {
          halted = true;
          setCompletedStages(event.completedStages);
          setCurrentStage(event.stage);
          setHaltMessage(event.message);
          setStatusMessage(null);
          setIsRunning(false);
          return;
        }

        if (event.type === "error") {
          setCompletedStages(event.completedStages);
          const failed = stageNumberFromName(event.failedStage);
          setFailedStage(failed);
          setCurrentStage(failed ?? event.completedStages.at(-1) ?? 1);
          setStatusMessage(null);
          setError(event.error);
          setIsRunning(false);
          streamError = event.error;
          return;
        }

        if (event.type === "done") {
          finished = {
            runId: event.runId,
            state: event.state,
            completedStages: event.completedStages,
            databaseMatch: event.databaseMatch
          };
          window.localStorage.setItem("facts:last-analysis", JSON.stringify(finished));
          if (typeof event.databaseMatch === "boolean") {
            setDatabaseMatch(event.databaseMatch);
          }
          setCompletedStages(event.completedStages);
          setCurrentStage(event.completedStages.at(-1) ?? (nextSentiment ? 8 : 7));
          setStatusMessage("Briefing ready");
          setReportReady(true);
          setIsRunning(false);
          runningRef.current = false;
        }
      });

      if (streamError) {
        throw new Error(streamError);
      }

      if (halted) {
        setIsRunning(false);
        runningRef.current = false;
        return;
      }

      if (!finished) {
        throw new Error(
          "Connection closed before the pipeline finished. Keep npm run dev running. A long scrape can take a few minutes."
        );
      }

      window.localStorage.setItem("facts:last-analysis", JSON.stringify(finished));
      setReportReady(true);
      setIsRunning(false);
      runningRef.current = false;
    } catch (analysisError) {
      const message =
        analysisError instanceof TypeError && analysisError.message === "Failed to fetch"
          ? "Lost connection to the local server. Restart npm run dev and try again. Do not stop the terminal while analysis is running."
            : analysisError instanceof Error
            ? analysisError.message.toLowerCase().includes("failed to scrape")
              ? "No data could be found for this company."
              : analysisError.message
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
    autoStartedKeys.delete(`${trimmed}|${includeSentiment ? "1" : "0"}`);
    runningRef.current = false;
    void runAnalysis(trimmed, includeSentiment);
  }

  const runLabel = error ? "Stopped" : haltMessage ? "Not a company" : reportReady ? "Ready" : isRunning ? "Running" : "Idle";

  if (!urlFromQuery) {
    return (
      <div className="min-h-[100dvh] bg-paper text-ink">
        <SiteHeader compact />
        <p className="px-5 py-10 text-sm text-muted">Taking you to the home page...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <SiteHeader compact />

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <p className="font-mono text-[11px] text-muted">{runLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">This run</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Watch the scrape, then the company check. Later steps only run if this URL is a business.
          </p>

          {statusMessage ? (
            <p className="mt-4 text-sm font-medium text-amber">{statusMessage}</p>
          ) : null}

          <div className="mt-6">
            <PipelineProgress
              completedStages={completedStages}
              currentStage={currentStage}
              failedStage={failedStage}
              includeSentiment={includeSentiment}
            />
          </div>

          {reportReady ? (
            <Link
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#236b5b] px-4 text-sm font-semibold text-[#f3f4ee]"
              href="/results"
            >
              Open report
            </Link>
          ) : null}

          <form className="mt-8 flex flex-col gap-4 border-t border-line pt-6" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="company-url">
                Company URL
              </label>
              <input
                className="h-11 rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none placeholder:text-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
              {isRunning ? "Running..." : "Run again"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </aside>

        <section className="min-w-0 rounded-xl border border-line bg-panel p-6 shadow-panel md:p-8">
          <h2 className="text-lg font-semibold">Briefing file</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Each block is what that step passed forward. Images and data URIs are stripped so you can
            actually read the page.
          </p>

          {haltMessage ? (
            <div className="mt-5 rounded-lg border border-amber/40 bg-amber/10 p-4 text-sm leading-6 text-ink">
              {haltMessage}
            </div>
          ) : null}

          {databaseMatch === false ? (
            <div className="mt-5">
              <LimitedDataBanner />
            </div>
          ) : null}

          <div className="mt-6">
              <StageOutputList
                error={error}
                failedStage={failedStage}
                liveMessage={isRunning ? statusMessage : null}
                notices={notices}
                stages={stageOutputs}
              />
          </div>
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
          <p className="px-5 py-10 text-sm text-muted">Opening this run...</p>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
