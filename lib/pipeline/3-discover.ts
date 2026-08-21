import { z } from "zod";
import { logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { tavilySearch } from "@/lib/clients/tavily";
import { PipelineStageError, type CompanyProfile } from "@/lib/types";

const STAGE = "Stage3-DiscoverCompetitors";

const CompetitorCandidateSchema = z.array(
  z.object({
    name: z.string(),
    domain: z.string().optional()
  })
);

export async function discoverCompetitors(
  profile: CompanyProfile
): Promise<{ name: string; domain?: string }[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "LLM-native discovery", {
    searchIntentPhrase: profile.searchIntentPhrase
  });

  try {
    const nativeCandidates = await structuredCall(
      STAGE,
      "You identify likely competitors from model knowledge only. Do not browse or rely on search results in this step.",
      `List companies that compete with a business described as: "${profile.searchIntentPhrase}".

Exclude ${profile.name}. Return a JSON array with name and optional domain.`,
      CompetitorCandidateSchema
    );

    logger.debug(STAGE, "enriching candidates with Tavily where domains are missing", {
      candidates: nativeCandidates.length
    });

    const enriched = await Promise.all(
      nativeCandidates.map(async (candidate) => {
        if (candidate.domain) {
          return candidate;
        }
        const results = await tavilySearch(`${candidate.name} official website`).catch((error) => {
          logger.stageWarn(STAGE, "Tavily enrichment failed", {
            candidate: candidate.name,
            error: error instanceof Error ? error.message : String(error)
          });
          return [];
        });
        const domain = results[0]?.url
          ? new URL(results[0].url).hostname.replace(/^www\./, "")
          : undefined;
        return { ...candidate, domain };
      })
    );

    const deduped = dedupeByName(enriched);
    logger.stageComplete(STAGE, "competitors discovered", {
      durationMs: Date.now() - start,
      candidates: deduped.length
    });
    return deduped;
  } catch (error) {
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}

function dedupeByName(candidates: { name: string; domain?: string }[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
