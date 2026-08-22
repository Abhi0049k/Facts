export type PipelineStreamEvent =
  | { type: "stage"; stage: number; status: "start" | "complete"; message: string }
  | { type: "done"; runId: string; state: import("./types").PipelineState; completedStages: number[] }
  | {
      type: "error";
      runId: string;
      error: string;
      failedStage?: string;
      completedStages: number[];
    };
