"use client";

import { useState } from "react";
import { ArrowRight, Globe2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PipelineProgress, stageNumberFromName } from "@/components/PipelineProgress";
import { readAnalyzeStream } from "@/lib/client/read-analyze-stream";
import type { AnalyzeResponse } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [companyUrl, setCompanyUrl] = useState("");
  const [includeSentiment, setIncludeSentiment] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFailedStage(null);
    setIsRunning(true);
    setCurrentStage(1);
    setCompletedStages([]);
    setStatusMessage("Starting pipeline…");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ companyUrl, includeSentiment })
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
          setCurrentStage(includeSentiment ? 8 : 7);
          setStatusMessage("Analysis complete");
        }
      });

      if (streamError) {
        throw new Error(streamError);
      }

      if (!finished) {
        throw new Error(
          "Connection closed before the pipeline finished. Keep npm run dev running — a long scrape can take a few minutes."
        );
      }

      window.localStorage.setItem("facts:last-analysis", JSON.stringify(finished));
      router.push("/results");
    } catch (analysisError) {
      const message =
        analysisError instanceof TypeError && analysisError.message === "Failed to fetch"
          ? "Lost connection to the local server. Restart npm run dev and try again — do not stop the terminal while analysis is running."
          : analysisError instanceof Error
            ? analysisError.message
            : "Analysis failed";
      setError(message);
      setStatusMessage(null);
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6">
      <header className="mb-8 flex flex-col items-start gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">Facts</div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Competitor intelligence grounded in real data
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
          Analyze any company site to discover top market competitors, extract structured metrics,
          and visualize direct product overlap automatically.
        </p>
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm font-medium text-coral">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[420px_1fr] lg:items-start">
        {/* Left Column: Form Section */}
        <section className="rounded-2xl border border-line bg-panel p-6 shadow-panel md:p-8">
          <form className="flex flex-col gap-5" onSubmit={runAnalysis}>
            <div>
              <label
                className="mb-2 block text-sm font-medium text-ink"
                htmlFor="company-url"
              >
                Company URL
              </label>
              <div className="relative">
                <Globe2 className="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full rounded-md border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                  id="company-url"
                  onChange={(event) => setCompanyUrl(event.target.value)}
                  placeholder="company.com or https://company.com"
                  type="text"
                  value={companyUrl}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 py-1">
              <input
                checked={includeSentiment}
                className="h-5 w-5 cursor-pointer rounded-md border-line text-accent accent-accent"
                onChange={(event) => setIncludeSentiment(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm font-medium text-neutral-700">
                Include sentiment analysis
              </span>
            </label>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d594c] active:bg-[#16443a] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:opacity-50"
              disabled={isRunning || !companyUrl.trim()}
            >
              {isRunning ? "Running analysis…" : "Analyze company"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* Right Column: Pipeline Status & Execution Track */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-semibold leading-none text-ink">Pipeline Status</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Each stage takes a defined input, returns structured JSON, and writes to a shared
              pipeline state. The sequence is fixed for predictable cost and behavior.
            </p>
            {statusMessage ? (
              <p className="mt-3 text-sm font-medium text-amber">{statusMessage}</p>
            ) : null}
          </div>

          <PipelineProgress
            completedStages={completedStages}
            currentStage={currentStage}
            failedStage={failedStage}
            includeSentiment={includeSentiment}
          />
        </section>
      </div>
    </main>
  );
}