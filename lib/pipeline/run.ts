import { logger } from "@/lib/clients/logger";
import { lookupCompany } from "@/lib/pipeline/0-lookup";
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
import type {
  AnalyzeResponse,
  CompetitorScrapeResult,
  PipelineCheckpoint,
  PipelineState,
  StageOutputRecord
} from "@/lib/types";

const STAGE_LABELS: Record<number, string> = {
  0: "Lookup",
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
  onEvent: (event: PipelineStreamEvent) => void | Promise<void>,
  options?: {
    resume?: PipelineCheckpoint | null;
    onCheckpoint?: (checkpoint: PipelineCheckpoint) => void | Promise<void>;
  }
): Promise<AnalyzeResponse> {
  let completedStages = uniqueStages(options?.resume?.completedStages ?? []);
  let stagePayloads: StageOutputRecord[] = [...(options?.resume?.stagePayloads ?? [])];
  const startTime = Date.now();
  const state: PipelineState = options?.resume?.state
    ? {
        userCompany: options.resume.state.userCompany ?? null,
        competitorsRaw: options.resume.state.competitorsRaw ?? null,
        competitorsRanked: options.resume.state.competitorsRanked ?? null,
        competitorProfiles: options.resume.state.competitorProfiles ?? [],
        comparison: options.resume.state.comparison ?? null,
        sentiment: options.resume.state.sentiment ?? null
      }
    : {
    userCompany: null,
    competitorsRaw: null,
    competitorsRanked: null,
    competitorProfiles: [],
    comparison: null,
    sentiment: null
      };
  let lookup = options?.resume?.lookup as Awaited<ReturnType<typeof lookupCompany>> | undefined;
  let rawContent = options?.resume?.rawContent;
  let understood = options?.resume?.understood as Awaited<ReturnType<typeof understandCompany>> | undefined;
  let competitorScrapes = options?.resume?.competitorScrapes;
  let databaseMatch = options?.resume?.databaseMatch;

  const checkpoint = async () => {
    await options?.onCheckpoint?.({
      companyUrl: input.companyUrl,
      normalizedDomain: lookup?.domain ?? options?.resume?.normalizedDomain ?? "",
      includeSentiment: input.includeSentiment,
      completedStages,
      stagePayloads,
      state,
      databaseMatch,
      lookup,
      rawContent,
      understood,
      competitorScrapes
    });
  };

  const completeStage = async (stage: number, payload: unknown) => {
    completedStages = uniqueStages([...completedStages, stage]);
    stagePayloads = [
      ...stagePayloads.filter((item) => item.stage !== stage),
      { stage, title: `Finished ${STAGE_LABELS[stage]}`, payload }
    ];
    await emitStage(onEvent, stage, "complete", payload);
    await checkpoint();
  };

  for (const cached of stagePayloads.sort((a, b) => a.stage - b.stage)) {
    await emitStage(onEvent, cached.stage, "complete", cached.payload);
  }

  logger.pipelineStart(input.runId, {
    companyUrl: input.companyUrl,
    includeSentiment: input.includeSentiment,
    resumedStages: completedStages
  });

  if (!hasStage(completedStages, 0) || !lookup) {
    invalidateFrom(0);
    await emitStage(onEvent, 0, "start");
    lookup = await lookupCompany(input.companyUrl);
    databaseMatch = lookup.found;
    await completeStage(0, {
      databaseMatch: lookup.found,
      domain: lookup.domain,
      companyName: lookup.found ? lookup.companyName : null,
      infoUrls: lookup.found ? lookup.infoUrls : [],
      sentimentUrls: lookup.found ? lookup.sentimentUrls : []
    });
  }

  if (!lookup.found) {
    const message = lookup.domain
      ? `${lookup.domain} is not in the company database. Add this company before running a briefing.`
      : "This company is not in the company database. Add this company before running a briefing.";
    logger.pipelineComplete(input.runId, Date.now() - startTime, {
      completedStages,
      halted: "database_miss",
      domain: lookup.domain
    });
    await onEvent({
      type: "halted",
      stage: 0,
      siteKind: "not_a_company",
      message,
      payload: {
        databaseMatch: false,
        domain: lookup.domain
      },
      completedStages
    });
    return {
      runId: input.runId,
      state,
      completedStages,
      halted: true,
      haltMessage: message,
      databaseMatch: false
    };
  }

  if (!hasStage(completedStages, 1) || !rawContent) {
    invalidateFrom(1);
    await emitStage(onEvent, 1, "start");
    const userCompanySources = uniqueSources([...lookup.infoUrls, ...lookup.sentimentUrls]);
    rawContent = await ingestUserCompany(
      input.companyUrl,
      userCompanySources
    );
    await completeStage(1, {
      url: input.companyUrl,
      sourceUrls: userCompanySources.map((source) => source.url),
      sourceCount: userCompanySources.length,
      chars: rawContent.length,
      content: readableScrape(rawContent, SCRAPE_PREVIEW_CHARS),
      truncated: rawContent.length > SCRAPE_PREVIEW_CHARS
    });
  }

  if (!hasStage(completedStages, 2) || !understood) {
    invalidateFrom(2);
    await emitStage(onEvent, 2, "start");
    understood = await understandCompany(rawContent, input.companyUrl, {
      knownName: lookup.found ? lookup.companyName : undefined
    });
    await completeStage(2, {
      siteKind: understood.siteKind,
      reason: understood.reason,
      profile: understood.profile
    });
  }

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
    return { runId: input.runId, state, completedStages, halted: true, haltMessage: message, databaseMatch: lookup.found };
  }

  state.userCompany = understood.profile;

  if (!hasStage(completedStages, 3) || !state.competitorsRaw) {
    invalidateFrom(3);
    await emitStage(onEvent, 3, "start");
    state.competitorsRaw = await discoverCompetitors(state.userCompany);
    await completeStage(3, { candidates: state.competitorsRaw });
  }

  if (!hasStage(completedStages, 4) || !state.competitorsRanked) {
    invalidateFrom(4);
    await emitStage(onEvent, 4, "start");
    state.competitorsRanked = await rankCompetitors(state.userCompany, state.competitorsRaw);
    await completeStage(4, { ranked: state.competitorsRanked });
  }

  if (!hasStage(completedStages, 5) || !competitorScrapes) {
    invalidateFrom(5);
    await emitStage(onEvent, 5, "start");
    competitorScrapes = await scrapeCompetitors(state.competitorsRanked);
    await completeStage(5, { scrapes: summarizeCompetitorScrapes(competitorScrapes) });
  }

  if (!hasStage(completedStages, 6) || !state.competitorProfiles.length) {
    invalidateFrom(6);
    await emitStage(onEvent, 6, "start");
    state.competitorProfiles = await extractCompetitorProfiles(competitorScrapes, async (message) => {
      await onEvent({
        type: "stage",
        stage: 6,
        status: "retry",
        message
      });
    });
    await completeStage(6, {
      profiles: state.competitorProfiles.map((profile) => ({
        name: profile.name,
        domain: profile.domain,
        category: profile.category,
        offeringsSummary: profile.offeringsSummary,
        stats: profile.stats
      }))
    });
  }

  if (!hasStage(completedStages, 7) || !state.comparison) {
    invalidateFrom(7);
    await emitStage(onEvent, 7, "start");
    state.comparison = await compareCompanies(state.userCompany, state.competitorProfiles);
    await completeStage(7, {
      markdown: state.comparison.markdown
    });
  }

  if (input.includeSentiment && (!hasStage(completedStages, 8) || !state.sentiment)) {
    invalidateFrom(8);
    await emitStage(onEvent, 8, "start");
    state.sentiment = await analyzeSentiment([state.userCompany, ...state.competitorProfiles], {
      userDomain: lookup.domain || state.userCompany.domain,
      knownSentimentUrls: lookup.found ? lookup.sentimentUrls : [],
      databaseMatch: lookup.found
    });
    await completeStage(8, { sentiment: state.sentiment });
  }

  logger.pipelineComplete(input.runId, Date.now() - startTime, { completedStages });
  return { runId: input.runId, state, completedStages, databaseMatch: lookup.found };

  function invalidateFrom(stage: number) {
    completedStages = completedStages.filter((completed) => completed < stage);
    stagePayloads = stagePayloads.filter((payload) => payload.stage < stage);
    if (stage <= 3) {
      state.competitorsRaw = null;
    }
    if (stage <= 4) {
      state.competitorsRanked = null;
    }
    if (stage <= 5) {
      competitorScrapes = undefined;
    }
    if (stage <= 6) {
      state.competitorProfiles = [];
    }
    if (stage <= 7) {
      state.comparison = null;
    }
    if (stage <= 8) {
      state.sentiment = null;
    }
  }
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

function uniqueStages(stages: number[]) {
  return [...new Set(stages)].sort((a, b) => a - b);
}

function hasStage(stages: number[], stage: number) {
  return stages.includes(stage);
}

function uniqueSources<T extends { url: string }>(sources: T[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) {
      return false;
    }
    seen.add(source.url);
    return true;
  });
}
