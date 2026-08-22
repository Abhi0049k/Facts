import { AlertCircle, Check, Loader2 } from "lucide-react";
import { stageNumberFromName } from "@/lib/stage-number";

export { stageNumberFromName };

const stages = [
  "Ingest",
  "Understand",
  "Discover",
  "Rank",
  "Scrape",
  "Extract",
  "Compare",
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
    <ol className="border-l border-line pl-5">
      {visibleStages.map((stage, index) => {
        const number = index + 1;
        const failed = failedStage === number;
        const completed = completedStages.includes(number) && !failed;
        const active = currentStage === number && !completed && !failed;

        return (
          <li className="relative pb-5 last:pb-0" key={stage}>
            <span
              className={`absolute -left-[1.55rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                failed
                  ? "border-coral bg-coral text-[#f3f4ee]"
                  : completed
                    ? "border-accent bg-accent text-[#f3f4ee]"
                    : active
                      ? "border-amber bg-panel text-amber"
                      : "border-line bg-panel text-muted"
              }`}
            >
              {failed ? (
                <AlertCircle className="h-3 w-3" />
              ) : completed ? (
                <Check className="h-3 w-3" />
              ) : active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                number
              )}
            </span>
            <p
              className={`text-sm font-medium ${
                failed ? "text-coral" : active ? "text-ink" : completed ? "text-ink" : "text-muted"
              }`}
            >
              {stage}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
