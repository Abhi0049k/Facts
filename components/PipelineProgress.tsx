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
    <ol className="grid gap-2 md:grid-cols-4">
      {visibleStages.map((stage, index) => {
        const number = index + 1;
        const failed = failedStage === number;
        const completed = completedStages.includes(number) && !failed;
        const active = currentStage === number && !completed && !failed;

        return (
          <li
            className="flex min-h-14 items-center gap-3 rounded-md border border-line bg-panel px-3 py-2 text-sm shadow-panel"
            key={stage}
          >
            {failed ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            ) : completed ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
            ) : active ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-neutral-400" />
            )}
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Stage {number}</div>
              <div className="font-medium text-ink">{stage}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function stageNumberFromName(stageName: string | undefined): number | null {
  if (!stageName) {
    return null;
  }
  const match = stageName.match(/stage\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}
