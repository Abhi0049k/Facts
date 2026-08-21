import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logger } from "@/lib/clients/logger";
import { ingestUserCompany } from "@/lib/pipeline/1-ingest";
import { understandCompany } from "@/lib/pipeline/2-understand";
import { discoverCompetitors } from "@/lib/pipeline/3-discover";
import { rankCompetitors } from "@/lib/pipeline/4-rank";
import { scrapeCompetitors } from "@/lib/pipeline/5-scrape-competitors";
import { extractCompetitorProfiles } from "@/lib/pipeline/6-extract";
import { compareCompanies } from "@/lib/pipeline/7-compare";
import { analyzeSentiment } from "@/lib/pipeline/8-sentiment";
import { PipelineStageError, type AnalyzeRequest, type AnalyzeResponse, type PipelineState } from "@/lib/types";

export async function POST(request: Request) {
  const runId = randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    const body = (await request.json()) as AnalyzeRequest;
    if (!body.companyUrl) {
      return NextResponse.json({ error: "companyUrl is required" }, { status: 400 });
    }

    logger.pipelineStart(runId, {
      companyUrl: body.companyUrl,
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
    const completedStages: number[] = [];

    const rawContent = await ingestUserCompany(body.companyUrl);
    completedStages.push(1);

    state.userCompany = await understandCompany(rawContent, body.companyUrl);
    completedStages.push(2);

    state.competitorsRaw = await discoverCompetitors(state.userCompany);
    completedStages.push(3);

    state.competitorsRanked = await rankCompetitors(state.userCompany, state.competitorsRaw);
    completedStages.push(4);

    const competitorScrapes = await scrapeCompetitors(state.competitorsRanked);
    completedStages.push(5);

    state.competitorProfiles = await extractCompetitorProfiles(competitorScrapes);
    completedStages.push(6);

    state.comparison = await compareCompanies(state.userCompany, state.competitorProfiles);
    completedStages.push(7);

    if (body.includeSentiment) {
      state.sentiment = await analyzeSentiment([state.userCompany, ...state.competitorProfiles]);
      completedStages.push(8);
    }

    logger.pipelineComplete(runId, Date.now() - startTime);

    const response: AnalyzeResponse = { runId, state, completedStages };
    return NextResponse.json(response);
  } catch (error) {
    const failedStage = error instanceof PipelineStageError ? error.stage : "unknown";
    logger.pipelineFailed(runId, failedStage, error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { runId, error: error instanceof Error ? error.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
