import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logger, withPipelineRun } from "@/lib/clients/logger";
import { ingestUserCompany } from "@/lib/pipeline/1-ingest";
import { understandCompany } from "@/lib/pipeline/2-understand";
import { discoverCompetitors } from "@/lib/pipeline/3-discover";
import { rankCompetitors } from "@/lib/pipeline/4-rank";
import { scrapeCompetitors } from "@/lib/pipeline/5-scrape-competitors";
import { extractCompetitorProfiles } from "@/lib/pipeline/6-extract";
import { compareCompanies } from "@/lib/pipeline/7-compare";
import { analyzeSentiment } from "@/lib/pipeline/8-sentiment";
import {
  PipelineStageError,
  type AnalyzeErrorResponse,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type PipelineState
} from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const runId = randomUUID().slice(0, 8);
  const startTime = Date.now();
  const completedStages: number[] = [];

  return withPipelineRun(runId, async () => {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const companyUrl = normalizeCompanyUrl(body.companyUrl);
    if (!companyUrl) {
      return NextResponse.json(
        { error: "Enter a valid company URL, for example https://company.com" } satisfies AnalyzeErrorResponse,
        { status: 400 }
      );
    }

    logger.pipelineStart(runId, {
      companyUrl,
      includeSentiment: Boolean(body.includeSentiment)
    });

    const state: PipelineState = {
      userCompany: null,
      competitorsRaw: null,
      competitorsRanked: null,
      competitorProfiles: [],
      comparison: null,
      sentiment: null
    };

    logger.debug("Pipeline", "Stage 1 ingest starting", { companyUrl });
    const rawContent = await ingestUserCompany(companyUrl);
    completedStages.push(1);
    logger.debug("Pipeline", "Stage 1 ingest finished", { chars: rawContent.length });

    logger.debug("Pipeline", "Stage 2 understand starting");
    state.userCompany = await understandCompany(rawContent, companyUrl);
    completedStages.push(2);
    logger.debug("Pipeline", "Stage 2 understand finished", {
      name: state.userCompany.name,
      category: state.userCompany.category
    });

    logger.debug("Pipeline", "Stage 3 discover starting", {
      searchIntentPhrase: state.userCompany.searchIntentPhrase
    });
    state.competitorsRaw = await discoverCompetitors(state.userCompany);
    completedStages.push(3);
    logger.debug("Pipeline", "Stage 3 discover finished", {
      candidates: state.competitorsRaw.length
    });

    logger.debug("Pipeline", "Stage 4 rank starting");
    state.competitorsRanked = await rankCompetitors(state.userCompany, state.competitorsRaw);
    completedStages.push(4);
    logger.debug("Pipeline", "Stage 4 rank finished", {
      selected: state.competitorsRanked.map((item) => item.domain)
    });

    logger.debug("Pipeline", "Stage 5 scrape starting", {
      competitors: state.competitorsRanked.length
    });
    const competitorScrapes = await scrapeCompetitors(state.competitorsRanked);
    completedStages.push(5);
    logger.debug("Pipeline", "Stage 5 scrape finished", {
      withAnySource: competitorScrapes.filter((item) =>
        Object.values(item.sources).some(Boolean)
      ).length
    });

    logger.debug("Pipeline", "Stage 6 extract starting");
    state.competitorProfiles = await extractCompetitorProfiles(competitorScrapes);
    completedStages.push(6);
    logger.debug("Pipeline", "Stage 6 extract finished", {
      profiles: state.competitorProfiles.map((profile) => profile.name)
    });

    logger.debug("Pipeline", "Stage 7 compare starting");
    state.comparison = await compareCompanies(state.userCompany, state.competitorProfiles);
    completedStages.push(7);
    logger.debug("Pipeline", "Stage 7 compare finished", {
      overlaps: state.comparison.serviceOverlap.length,
      gaps: state.comparison.gaps.length
    });

    if (body.includeSentiment) {
      logger.debug("Pipeline", "Stage 8 sentiment starting");
      state.sentiment = await analyzeSentiment([state.userCompany, ...state.competitorProfiles]);
      completedStages.push(8);
      logger.debug("Pipeline", "Stage 8 sentiment finished", {
        companies: state.sentiment.length
      });
    }

    logger.pipelineComplete(runId, Date.now() - startTime, { completedStages });

    const response: AnalyzeResponse = { runId, state, completedStages };
    return NextResponse.json(response);
  } catch (error) {
    const failedStage = error instanceof PipelineStageError ? error.stage : "unknown";
    logger.pipelineFailed(runId, failedStage, error instanceof Error ? error.message : String(error), {
      completedStages,
      durationMs: Date.now() - startTime
    });
    const payload: AnalyzeErrorResponse = {
      runId,
      error: error instanceof Error ? error.message : "Pipeline failed",
      failedStage,
      completedStages
    };
    return NextResponse.json(payload, { status: 500 });
  }
  });
}

function normalizeCompanyUrl(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
