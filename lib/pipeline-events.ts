import type { PipelineState, SiteKind } from "./types";

export type PipelineStreamEvent =
  | {
      type: "stage";
      stage: number;
      status: "start" | "complete" | "retry";
      message: string;
      payload?: unknown;
    }
  | {
      type: "halted";
      stage: number;
      siteKind: SiteKind;
      message: string;
      payload?: unknown;
      completedStages: number[];
    }
  | { type: "done"; runId: string; state: PipelineState; completedStages: number[] }
  | {
      type: "error";
      runId: string;
      error: string;
      failedStage?: string;
      completedStages: number[];
    };
