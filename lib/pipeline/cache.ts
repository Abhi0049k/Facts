import { Prisma } from "@prisma/client";
import { logger } from "@/lib/clients/logger";
import { prisma } from "@/lib/clients/prisma";
import { normalizeDomain } from "@/lib/normalize-domain";
import type { CompetitorScrapeResult, PipelineCheckpoint, PipelineState, StageOutputRecord } from "@/lib/types";

const STAGE = "WorkflowCache";
const TTL_MS = 4 * 24 * 60 * 60 * 1000;

export type WorkflowCacheStatus = "partial" | "complete" | "failed";

export type CachedWorkflow = PipelineCheckpoint & {
  cacheKey: string;
  status: WorkflowCacheStatus;
  failedStage?: string | null;
  error?: string | null;
  expiresAt: Date;
};

const emptyState: PipelineState = {
  userCompany: null,
  competitorsRaw: null,
  competitorsRanked: null,
  competitorProfiles: [],
  comparison: null,
  sentiment: null
};

export function workflowCacheKey(companyUrl: string, includeSentiment: boolean): {
  cacheKey: string;
  normalizedDomain: string;
} {
  const normalizedDomain = normalizeDomain(companyUrl);
  return {
    cacheKey: `${normalizedDomain || companyUrl.trim().toLowerCase()}::sentiment=${includeSentiment ? "1" : "0"}`,
    normalizedDomain
  };
}

export async function readWorkflowCache(
  companyUrl: string,
  includeSentiment: boolean
): Promise<CachedWorkflow | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  const { cacheKey } = workflowCacheKey(companyUrl, includeSentiment);
  try {
    const row = await prisma.workflowCache.findUnique({ where: { cacheKey } });
    if (!row) {
      return null;
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await prisma.workflowCache.delete({ where: { cacheKey } }).catch(() => undefined);
      logger.debug(STAGE, "expired cache entry removed", { cacheKey });
      return null;
    }

    return {
      cacheKey,
      companyUrl: row.companyUrl,
      normalizedDomain: row.normalizedDomain,
      includeSentiment: row.includeSentiment,
      status: asStatus(row.status),
      completedStages: row.completedStages,
      failedStage: row.failedStage,
      error: row.error,
      databaseMatch: row.databaseMatch ?? undefined,
      stagePayloads: asStagePayloads(row.stagePayloads),
      state: asPipelineState(row.state),
      lookup: row.lookup ?? undefined,
      rawContent: typeof row.rawContent === "string" ? row.rawContent : undefined,
      understood: row.understood ?? undefined,
      competitorScrapes: asCompetitorScrapes(row.competitorScrapes),
      expiresAt: row.expiresAt
    };
  } catch (error) {
    logger.stageWarn(STAGE, "cache read skipped", {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function writeWorkflowCache(
  checkpoint: PipelineCheckpoint,
  status: WorkflowCacheStatus,
  options?: { failedStage?: string; error?: string }
) {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }

  const { cacheKey, normalizedDomain } = workflowCacheKey(checkpoint.companyUrl, checkpoint.includeSentiment);
  const expiresAt = new Date(Date.now() + TTL_MS);

  try {
    await prisma.workflowCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        companyUrl: checkpoint.companyUrl,
        normalizedDomain,
        includeSentiment: checkpoint.includeSentiment,
        status,
        completedStages: checkpoint.completedStages,
        failedStage: options?.failedStage,
        error: options?.error,
        databaseMatch: checkpoint.databaseMatch,
        stagePayloads: toJson(checkpoint.stagePayloads),
        state: toNullableJson(checkpoint.state),
        lookup: toNullableJson(checkpoint.lookup),
        rawContent: checkpoint.rawContent,
        understood: toNullableJson(checkpoint.understood),
        competitorScrapes: toNullableJson(checkpoint.competitorScrapes),
        expiresAt
      },
      update: {
        companyUrl: checkpoint.companyUrl,
        normalizedDomain,
        includeSentiment: checkpoint.includeSentiment,
        status,
        completedStages: checkpoint.completedStages,
        failedStage: options?.failedStage,
        error: options?.error,
        databaseMatch: checkpoint.databaseMatch,
        stagePayloads: toJson(checkpoint.stagePayloads),
        state: toNullableJson(checkpoint.state),
        lookup: toNullableJson(checkpoint.lookup),
        rawContent: checkpoint.rawContent,
        understood: toNullableJson(checkpoint.understood),
        competitorScrapes: toNullableJson(checkpoint.competitorScrapes),
        expiresAt
      }
    });
    logger.debug(STAGE, "cache checkpoint written", {
      cacheKey,
      status,
      completedStages: checkpoint.completedStages
    });
  } catch (error) {
    logger.stageWarn(STAGE, "cache write skipped", {
      cacheKey,
      status,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function asStatus(value: string): WorkflowCacheStatus {
  return value === "complete" || value === "failed" ? value : "partial";
}

function asStagePayloads(value: unknown): StageOutputRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is StageOutputRecord => {
        return Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as StageOutputRecord).stage === "number" &&
            typeof (item as StageOutputRecord).title === "string"
        );
      })
    : [];
}

function asPipelineState(value: unknown): PipelineState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...emptyState };
  }
  const record = value as Partial<PipelineState>;
  return {
    userCompany: record.userCompany ?? null,
    competitorsRaw: record.competitorsRaw ?? null,
    competitorsRanked: record.competitorsRanked ?? null,
    competitorProfiles: Array.isArray(record.competitorProfiles) ? record.competitorProfiles : [],
    comparison: record.comparison ?? null,
    sentiment: record.sentiment ?? null
  };
}

function asCompetitorScrapes(value: unknown): CompetitorScrapeResult[] | undefined {
  return Array.isArray(value) ? (value as CompetitorScrapeResult[]) : undefined;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return toJson(value);
}
