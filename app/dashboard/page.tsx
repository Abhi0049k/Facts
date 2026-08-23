"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readAnalyzeStream } from "@/lib/client/read-analyze-stream";
import type { PipelineState } from "@/lib/types";

type StageId = "lookup" | "ingest" | "discover" | "rank" | "scrape" | "extract" | "sentiment" | "compare";
type StageStatus = "pending" | "active" | "done" | "error";

type UiStage = {
  id: StageId;
  label: string;
  backendStages: number[];
};

type StageView = {
  status: StageStatus;
  result: string;
  chips: string[];
  time: string;
};

const STAGES: UiStage[] = [
  { id: "lookup", label: "Looking up {domain} in the database", backendStages: [0] },
  { id: "ingest", label: "Scraping company profile", backendStages: [1, 2] },
  { id: "discover", label: "Discovering competitors", backendStages: [3] },
  { id: "rank", label: "Ranking top competitor candidates", backendStages: [4] },
  { id: "scrape", label: "Scraping competitor sources", backendStages: [5] },
  { id: "extract", label: "Extracting structured profiles", backendStages: [6] },
  { id: "sentiment", label: "Scanning sentiment sources", backendStages: [8] },
  { id: "compare", label: "Building comparison", backendStages: [7] },
];

const INITIAL_STAGE_VIEW: StageView = {
  status: "pending",
  result: "",
  chips: [],
  time: "",
};

function createInitialStages() {
  return STAGES.reduce<Record<StageId, StageView>>((acc, stage) => {
    acc[stage.id] = { ...INITIAL_STAGE_VIEW };
    return acc;
  }, {} as Record<StageId, StageView>);
}

function stageForBackend(stageNumber: number): UiStage | undefined {
  return STAGES.find((stage) => stage.backendStages.includes(stageNumber));
}

function summarizePayload(stageId: StageId, payload: unknown, state?: PipelineState | null) {
  const asRecord = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  if (stageId === "lookup") {
    return "Matched — verified sources checked for the company profile.";
  }
  if (stageId === "ingest") {
    const profile = state?.userCompany;
    return profile?.offeringsSummary ? `“${profile.offeringsSummary}”` : "Company profile content collected and understood.";
  }
  if (stageId === "discover") {
    const candidates = state?.competitorsRaw ?? [];
    return `${candidates.length || "Multiple"} candidates found.`;
  }
  if (stageId === "rank") {
    return "Selected on relevance to program model and market overlap:";
  }
  if (stageId === "scrape") {
    const count = state?.competitorsRanked?.length ?? state?.competitorProfiles.length ?? 0;
    return `${count} competitor sources scraped across public sources.`;
  }
  if (stageId === "extract") {
    const total = (state?.competitorProfiles.length ?? 0) + (state?.userCompany ? 1 : 0);
    return `Founders, funding, headcount, and offerings extracted for ${total} companies.`;
  }
  if (stageId === "sentiment") {
    const sentiment = state?.sentiment ?? [];
    const scored = sentiment.filter((item) => item.dataAvailable).length;
    return `Reviews scored for ${scored} competitor sources.`;
  }
  if (stageId === "compare") {
    return asRecord ? "Comparison matrix generated across live company metrics." : "Comparison matrix generated across key metrics.";
  }
  return "Stage completed.";
}

function reportTitle(state: PipelineState | null) {
  const company = state?.comparison?.userCompany.name ?? state?.userCompany?.name ?? "Company";
  return `${company} vs. its competition`;
}

function getChips(stageId: StageId, state: PipelineState | null) {
  if (stageId === "discover") {
    return (state?.competitorsRaw ?? []).map((item) => item.name).slice(0, 6);
  }
  if (stageId === "rank") {
    return (state?.competitorsRanked ?? []).map((item) => item.name).slice(0, 5);
  }
  return [];
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStarted = useRef(false);
  const domain = searchParams.get("url") || "";
  const includeSentiment = searchParams.get("sentiment") === "1";
  const [stages, setStages] = useState(createInitialStages);
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [runStatus, setRunStatus] = useState("Facts is assembling your competitor view.");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");

  const orderedStages = useMemo(
    () => STAGES.filter((stage) => includeSentiment || stage.id !== "sentiment"),
    [includeSentiment]
  );

  useEffect(() => {
    if (!domain) {
      router.replace("/");
      return;
    }
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function startRun() {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyUrl: domain, includeSentiment }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "The analysis could not start.");
        }

        await readAnalyzeStream(response, (event) => {
          if (event.type === "stage") {
            const uiStage = stageForBackend(event.stage);
            if (!uiStage) return;

            setStages((current) => {
              const next = { ...current };
              const previous = next[uiStage.id];
              const status: StageStatus = event.status === "complete" ? "done" : "active";
              next[uiStage.id] = {
                ...previous,
                status,
                time: event.status === "complete" ? "done" : "working",
                result: event.status === "complete" ? previous.result || summarizePayload(uiStage.id, event.payload, pipelineState) : previous.result,
              };
              return next;
            });
          }

          if (event.type === "done") {
            setPipelineState(event.state);
            setStages((current) => {
              const next = { ...current };
              for (const stage of orderedStages) {
                next[stage.id] = {
                  ...next[stage.id],
                  status: "done",
                  time: "done",
                  result: next[stage.id].result || summarizePayload(stage.id, null, event.state),
                  chips: getChips(stage.id, event.state),
                };
              }
              return next;
            });
            setRunStatus("Your competitor view is ready.");
            setIsComplete(true);
            const params = new URLSearchParams({ url: domain });
            if (includeSentiment) params.set("sentiment", "1");
            const payload = JSON.stringify({
              generatedAt: new Date().toISOString(),
              domain,
              includeSentiment,
              state: event.state,
            });
            sessionStorage.setItem("facts:lastReport", payload);
            localStorage.setItem(`facts:report:${domain}:${includeSentiment ? "1" : "0"}`, payload);
          }

          if (event.type === "error") {
            setStages((current) => {
              const next = { ...current };
              for (const stage of orderedStages) {
                if (next[stage.id].status === "active") {
                  next[stage.id] = { ...next[stage.id], status: "error", time: "" };
                }
              }
              return next;
            });
            setError(event.error);
            setRunStatus(event.error);
          }
        });
      } catch (runError) {
        const message = runError instanceof Error ? runError.message : "The analysis failed.";
        setError(message);
        setRunStatus(message);
      }
    }

    startRun();
  }, [domain, includeSentiment, orderedStages, pipelineState, router]);

  function openReport() {
    const params = new URLSearchParams({ url: domain });
    if (includeSentiment) params.set("sentiment", "1");
    router.push(`/results?${params.toString()}`);
  }

  return (
    <>
      <nav className="topbar">
        <div className="brand"><span className="dot" />FACTS</div>
        <div className="topbar-right">
          <div className="run-progress" aria-label="Step 2 of 3">
            <span className="step complete" />
            <span className="step current" />
            <span className="step" />
          </div>
          <span className="domain-pill">{domain}</span>
          <button className="btn primary" disabled={!isComplete} onClick={openReport}>Open report <span aria-hidden="true">↗</span></button>
        </div>
      </nav>

      <main className="page">
        <div className="page-inner">
          <div className="eyebrow">Analysis in progress <span className="eyebrow-muted">02 / 03</span></div>
          <div className="run-heading">
            <div>
              <h1>Reading the field.</h1>
              <p aria-live="polite">{runStatus}</p>
            </div>
          </div>

          <div className="stage-list">
            {orderedStages.map((stage) => {
              const view = stages[stage.id];
              return (
                <div key={stage.id} className={`stage-row${view.status === "active" ? " active" : ""}${view.status === "done" ? " done" : ""}${view.status === "error" ? " error" : ""}`} data-stage={stage.id}>
                  <div className="stage-head">
                    <span className="stage-status">{view.status === "done" ? "✓" : ""}</span>
                    <span className="stage-label">{stage.label.replace("{domain}", domain)}</span>
                    <span className="stage-time">{view.time}</span>
                  </div>
                  <div className="stage-result">
                    <div className="stage-result-inner">
                      {view.result || "Waiting for live pipeline data."}
                      {view.chips.length > 0 && (
                        <div className="chip-row">
                          {view.chips.map((chip) => <span className="mini-chip" key={chip}>{chip}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`summary-panel${isComplete ? " shown" : ""}`}>
            <h3>{reportTitle(pipelineState)}</h3>
            <div className="summary-mini-row"><span className="k">Closest match</span><span>{pipelineState?.competitorsRanked?.[0]?.name ?? "None identified"}</span></div>
            <div className="summary-mini-row"><span className="k">Furthest match</span><span>{pipelineState?.competitorsRanked?.[(pipelineState?.competitorsRanked?.length ?? 1) - 1]?.name ?? "None identified"}</span></div>
            <div className="summary-mini-row"><span className="k">Sentiment coverage</span><span>{includeSentiment ? `${pipelineState?.sentiment?.filter((item) => item.dataAvailable).length ?? 0} scored` : "Not run"}</span></div>
            {error && <div className="summary-mini-row"><span className="k">Run status</span><span>{error}</span></div>}
            <div className="summary-cta"><button className="btn primary" disabled={!isComplete} onClick={openReport}>Open full report <span aria-hidden="true">↗</span></button></div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="page"><div className="page-inner">Loading…</div></main>}>
      <DashboardPageInner />
    </Suspense>
  );
}
