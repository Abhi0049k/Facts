import { logger } from "@/lib/clients/logger";
import { ingestUserCompany } from "@/lib/pipeline/1-ingest";
import { understandCompany } from "@/lib/pipeline/2-understand";
import { discoverCompetitors } from "@/lib/pipeline/3-discover";
import { rankCompetitors } from "@/lib/pipeline/4-rank";
import { scrapeCompetitors } from "@/lib/pipeline/5-scrape-competitors";
import { extractCompetitorProfiles } from "@/lib/pipeline/6-extract";
import { compareCompanies } from "@/lib/pipeline/7-compare";
import { analyzeSentiment } from "@/lib/pipeline/8-sentiment";
import type { PipelineStreamEvent } from "@/lib/pipeline-events";
import { compactSourceText, readableScrape } from "@/lib/readable-scrape";
import type { AnalyzeResponse, CompetitorScrapeResult, PipelineState } from "@/lib/types";

const STAGE_LABELS: Record<number, string> = {
  1: "Ingest site",
  2: "Understand company",
  3: "Discover competitors",
  4: "Rank top five",
  5: "Scrape competitors",
  6: "Extract data",
  7: "Compare market",
  8: "Sentiment"
};

const SCRAPE_PREVIEW_CHARS = 16_000;

export async function runPipeline(
  input: { companyUrl: string; includeSentiment: boolean; runId: string },
  onEvent: (event: PipelineStreamEvent) => void | Promise<void>
): Promise<AnalyzeResponse> {
  const completedStages: number[] = [];
  const startTime = Date.now();
  const state: PipelineState = {
    userCompany: null,
    competitorsRaw: null,
    competitorsRanked: null,
    competitorProfiles: [],
    comparison: null,
    sentiment: null
  };

  logger.pipelineStart(input.runId, {
    companyUrl: input.companyUrl,
    includeSentiment: input.includeSentiment
  });

  await emitStage(onEvent, 1, "start");
  const rawContent = await ingestUserCompany(input.companyUrl);
  completedStages.push(1);
  await emitStage(onEvent, 1, "complete", {
    url: input.companyUrl,
    chars: rawContent.length,
    content: readableScrape(rawContent, 2200),
    truncated: rawContent.length > SCRAPE_PREVIEW_CHARS
  });

  await emitStage(onEvent, 2, "start");
  const understood = await understandCompany(rawContent, input.companyUrl);
  completedStages.push(2);
  await emitStage(onEvent, 2, "complete", {
    siteKind: understood.siteKind,
    reason: understood.reason,
    profile: understood.profile
  });

  if (understood.siteKind !== "company" || !understood.profile) {
    const message =
      understood.haltMessage ??
      "This URL is not a company homepage, so competitor discovery will not run.";
    logger.pipelineComplete(input.runId, Date.now() - startTime, {
      completedStages,
      halted: understood.siteKind
    });
    await onEvent({
      type: "halted",
      stage: 2,
      siteKind: understood.siteKind,
      message,
      payload: {
        siteKind: understood.siteKind,
        reason: understood.reason,
        scrapeChars: rawContent.length,
        scrapePreview: rawContent.slice(0, SCRAPE_PREVIEW_CHARS)
      },
      completedStages
    });
    return { runId: input.runId, state, completedStages, halted: true, haltMessage: message };
  }

  state.userCompany = understood.profile;

  await emitStage(onEvent, 3, "start");
  state.competitorsRaw = await discoverCompetitors(state.userCompany);
  completedStages.push(3);
  await emitStage(onEvent, 3, "complete", { candidates: state.competitorsRaw });

  await emitStage(onEvent, 4, "start");
  state.competitorsRanked = await rankCompetitors(state.userCompany, state.competitorsRaw);
  completedStages.push(4);
  await emitStage(onEvent, 4, "complete", { ranked: state.competitorsRanked });

  await emitStage(onEvent, 5, "start");
  const competitorScrapes = await scrapeCompetitors(state.competitorsRanked);
  completedStages.push(5);
  await emitStage(onEvent, 5, "complete", { scrapes: summarizeCompetitorScrapes(competitorScrapes) });

  await emitStage(onEvent, 6, "start");
  state.competitorProfiles = await extractCompetitorProfiles(competitorScrapes, async (message) => {
    await onEvent({
      type: "stage",
      stage: 6,
      status: "retry",
      message
    });
  });
  completedStages.push(6);
  await emitStage(onEvent, 6, "complete", {
    profiles: state.competitorProfiles.map((profile) => ({
      name: profile.name,
      domain: profile.domain,
      category: profile.category,
      offeringsSummary: profile.offeringsSummary,
      stats: profile.stats
    }))
  });

  await emitStage(onEvent, 7, "start");
  state.comparison = await compareCompanies(state.userCompany, state.competitorProfiles);
  completedStages.push(7);
  await emitStage(onEvent, 7, "complete", {
    serviceOverlap: state.comparison.serviceOverlap,
    gaps: state.comparison.gaps
  });

  if (input.includeSentiment) {
    await emitStage(onEvent, 8, "start");
    state.sentiment = await analyzeSentiment([state.userCompany, ...state.competitorProfiles]);
    completedStages.push(8);
    await emitStage(onEvent, 8, "complete", { sentiment: state.sentiment });
  }

  logger.pipelineComplete(input.runId, Date.now() - startTime, { completedStages });
  return { runId: input.runId, state, completedStages };
}

async function emitStage(
  onEvent: (event: PipelineStreamEvent) => void | Promise<void>,
  stage: number,
  status: "start" | "complete",
  payload?: unknown
) {
  await onEvent({
    type: "stage",
    stage,
    status,
    message: `${status === "start" ? "Running" : "Finished"} ${STAGE_LABELS[stage]}`,
    payload
  });
}

function summarizeCompetitorScrapes(results: CompetitorScrapeResult[]) {
  return results.map((result) => ({
    name: result.competitor.name,
    domain: result.competitor.domain,
    sources: Object.fromEntries(
      Object.entries(result.sources).map(([source, text]) => [
        source,
        text
          ? {
              chars: text.length,
              preview: compactSourceText(text, 700) ?? ""
            }
          : null
      ])
    )
  }));
}
