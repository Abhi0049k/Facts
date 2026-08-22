import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";

const stages = [
  "Ingest site",
  "Understand company",
  "Discover competitors",
  "Rank top five",
  "Scrape competitors",
  "Extract data",
  "Compare market",
  "Sentiment"
];

interface PipelineProgressProps {
  currentStage: number;
  includeSentiment: boolean;
  completedStages?: number[];
  failedStage?: number | null;
}

export function PipelineProgress({
  currentStage,
  includeSentiment,
  completedStages = [],
  failedStage = null
}: PipelineProgressProps) {
  const visibleStages = includeSentiment ? stages : stages.slice(0, 7);

  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Pipeline Execution Stage
        </h3>
        <span className="text-xs font-medium text-accent">
          {completedStages.length} of {visibleStages.length} completed
        </span>
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {visibleStages.map((stage, index) => {
          const number = index + 1;
          const failed = failedStage === number;
          const completed = completedStages.includes(number) && !failed;
          const active = currentStage === number && !completed && !failed;

          return (
            <li
              className={`flex flex-col items-center justify-between rounded-xl border p-3 text-center transition ${
                failed
                  ? "border-coral/40 bg-coral/5"
                  : completed
                    ? "border-accent/30 bg-accent/5"
                    : active
                      ? "border-amber bg-amber/5"
                      : "border-line bg-paper/50"
              }`}
              key={stage}
            >
              <div
                className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition ${
                  failed
                    ? "bg-coral text-white"
                    : completed
                      ? "bg-accent text-white"
                      : active
                        ? "border-2 border-amber bg-panel text-amber"
                        : "border border-line bg-panel text-neutral-400"
                }`}
              >
                {failed ? (
                  <AlertCircle className="h-4 w-4" />
                ) : completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>{number}</span>
                )}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Stage {number}
              </div>
              <div
                className={`mt-0.5 text-xs font-medium leading-tight ${
                  failed
                    ? "text-coral font-semibold"
                    : completed
                      ? "text-ink"
                      : active
                        ? "text-amber font-semibold"
                        : "text-neutral-500"
                }`}
              >
                {stage}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function stageNumberFromName(stageName: string | undefined): number | null {
  if (!stageName) {
    return null;
  }
  const match = stageName.match(/stage\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}
