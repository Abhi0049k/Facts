import { AsyncLocalStorage } from "async_hooks";
import { PipelineStageError } from "@/lib/types";
import { emitPipelineNotice } from "@/lib/pipeline/notices";

const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  bold: "\x1b[1m"
};

const runContext = new AsyncLocalStorage<{ runId: string }>();

export function withPipelineRun<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  return runContext.run({ runId }, fn);
}

function timestamp(): string {
  return new Date().toISOString().split("T")[1].replace("Z", "");
}

function runTag(): string {
  const runId = runContext.getStore()?.runId;
  return runId ? `${COLORS.bold}[${runId}]${COLORS.reset} ` : "";
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 280 ? `${value.slice(0, 280)}…(${value.length} chars)` : value;
  }
  if (typeof value !== "object" || depth > 4) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => sanitize(item, depth + 1));
  }
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 20);
  return Object.fromEntries(entries.map(([key, item]) => [key, sanitize(item, depth + 1)]));
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }
  return ` ${COLORS.gray}${JSON.stringify(sanitize(meta))}${COLORS.reset}`;
}

function line(color: string, glyph: string, stage: string, message: string, meta?: Record<string, unknown>) {
  console.log(
    `${COLORS.gray}${timestamp()}${COLORS.reset} ${runTag()}${color}${glyph} [${stage}]${COLORS.reset} ${message}${formatMeta(meta)}`
  );
}

export const logger = {
  pipelineStart(runId: string, input: Record<string, unknown>) {
    console.log(
      `\n${COLORS.bold}${COLORS.cyan}━━━ PIPELINE START [${runId}] ━━━${COLORS.reset}`
    );
    console.log(
      `${COLORS.gray}${timestamp()}${COLORS.reset} ${COLORS.bold}[${runId}]${COLORS.reset} input:${formatMeta(input)}`
    );
  },

  pipelineComplete(runId: string, totalDurationMs: number, extra?: Record<string, unknown>) {
    console.log(
      `${COLORS.bold}${COLORS.green}━━━ PIPELINE COMPLETE [${runId}] in ${totalDurationMs}ms ━━━${COLORS.reset}${formatMeta(extra)}\n`
    );
  },

  pipelineFailed(runId: string, failedStage: string, error: string, extra?: Record<string, unknown>) {
    console.log(
      `${COLORS.bold}${COLORS.red}━━━ PIPELINE FAILED [${runId}] at ${failedStage} ━━━${COLORS.reset}`
    );
    console.log(`${COLORS.red}${error}${COLORS.reset}${formatMeta(extra)}\n`);
  },

  stageStart(stage: string, action: string, meta?: Record<string, unknown>) {
    line(COLORS.cyan, "▶", stage, action, meta);
  },

  stageComplete(stage: string, action: string, meta?: Record<string, unknown>) {
    line(COLORS.green, "✓", stage, action, meta);
  },

  stageWarn(stage: string, message: string, meta?: Record<string, unknown>) {
    line(COLORS.yellow, "⚠", stage, message, meta);
    emitPipelineNotice(stage, humanNotice(stage, message, meta));
  },

  stageError(stage: string, message: string, meta?: Record<string, unknown>) {
    line(COLORS.red, "✗", stage, message, meta);
    emitPipelineNotice(stage, humanNotice(stage, message, meta));
  },

  debug(stage: string, message: string, meta?: Record<string, unknown>) {
    line(COLORS.gray, "·", stage, message, meta);
  },

  exception(stage: string, error: unknown, meta?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error));
    line(COLORS.red, "✗", stage, err.message, {
      ...meta,
      name: err.name,
      stack: err.stack?.split("\n").slice(0, 6).join(" | ")
    });
  }
};

export function failStage(stage: string, error: unknown, meta?: Record<string, unknown>): never {
  logger.exception(stage, error, meta);
  if (error instanceof PipelineStageError) {
    throw error;
  }
  throw new PipelineStageError(stage, error instanceof Error ? error.message : String(error));
}

export async function logStage<T>(
  stage: string,
  action: string,
  startMeta: Record<string, unknown>,
  fn: () => Promise<T>,
  summarize?: (result: T) => Record<string, unknown>
): Promise<T> {
  const started = Date.now();
  logger.stageStart(stage, action, startMeta);
  try {
    const result = await fn();
    logger.stageComplete(stage, action, {
      durationMs: Date.now() - started,
      ...(summarize ? summarize(result) : {})
    });
    return result;
  } catch (error) {
    logger.exception(stage, error, { action, durationMs: Date.now() - started, ...startMeta });
    throw error;
  }
}

function humanNotice(stage: string, message: string, meta?: Record<string, unknown>): string {
  if (message.toLowerCase().includes("schema")) {
    const fields = Array.isArray(meta?.missingFields)
      ? (meta.missingFields as unknown[]).filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const unique = [...new Set(fields.map((field) => field.replace(/^\d+\./, "") || field))];
    return unique.length
      ? `The model reply did not match the expected shape. Missing ${unique.slice(0, 6).join(", ")}.`
      : "The model reply did not match the expected shape.";
  }
  return message;
}
