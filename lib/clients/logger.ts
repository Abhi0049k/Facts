// lib/clients/logger.ts

const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  bold: "\x1b[1m"
};

function timestamp(): string {
  return new Date().toISOString().split("T")[1].replace("Z", "");
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  return ` ${COLORS.gray}${JSON.stringify(meta)}${COLORS.reset}`;
}

export const logger = {
  /** Pipeline-level: a new run has started */
  pipelineStart(runId: string, input: Record<string, unknown>) {
    console.log(
      `\n${COLORS.bold}${COLORS.cyan}━━━ PIPELINE START [${runId}] ━━━${COLORS.reset}`
    );
    console.log(`${COLORS.gray}${timestamp()}${COLORS.reset} input:`, input);
  },

  /** Pipeline-level: the full run finished successfully */
  pipelineComplete(runId: string, totalDurationMs: number) {
    console.log(
      `${COLORS.bold}${COLORS.green}━━━ PIPELINE COMPLETE [${runId}] - ${totalDurationMs}ms ━━━${COLORS.reset}\n`
    );
  },

  /** Pipeline-level: the run failed and could not continue */
  pipelineFailed(runId: string, failedStage: string, error: string) {
    console.log(
      `${COLORS.bold}${COLORS.red}━━━ PIPELINE FAILED [${runId}] at ${failedStage} ━━━${COLORS.reset}`
    );
    console.log(`${COLORS.red}${error}${COLORS.reset}\n`);
  },

  /** A stage (or a sub-step within a stage, e.g. an LLM call) has started */
  stageStart(stage: string, action: string, meta?: Record<string, unknown>) {
    console.log(
      `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.cyan}▶ [${stage}]${COLORS.reset} ${action}${formatMeta(meta)}`
    );
  },

  /** A stage finished successfully */
  stageComplete(stage: string, action: string, meta?: Record<string, unknown>) {
    console.log(
      `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.green}✓ [${stage}]${COLORS.reset} ${action}${formatMeta(meta)}`
    );
  },

  /** A stage encountered a recoverable issue */
  stageWarn(stage: string, message: string, meta?: Record<string, unknown>) {
    console.log(
      `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.yellow}⚠ [${stage}]${COLORS.reset} ${message}${formatMeta(meta)}`
    );
  },

  /** A stage failed */
  stageError(stage: string, message: string, meta?: Record<string, unknown>) {
    console.log(
      `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.red}✗ [${stage}]${COLORS.reset} ${message}${formatMeta(meta)}`
    );
  },

  /** Generic debug line for anything mid-stage worth tracing */
  debug(stage: string, message: string, meta?: Record<string, unknown>) {
    console.log(
      `${COLORS.gray}${timestamp()} [${stage}] ${message}${formatMeta(meta)}${COLORS.reset}`
    );
  }
};
