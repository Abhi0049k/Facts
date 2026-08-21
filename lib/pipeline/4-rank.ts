import { z } from "zod";
import { logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { PipelineStageError, type CompanyProfile } from "@/lib/types";

const STAGE = "Stage4-RankCompetitors";

const RankedCompetitorsSchema = z
  .array(
    z.object({
      name: z.string(),
      domain: z.string()
    })
  )
  .max(5);

export async function rankCompetitors(
  userCompany: CompanyProfile,
  rawCandidates: { name: string; domain?: string }[]
): Promise<{ name: string; domain: string }[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "ranking competitors", { candidates: rawCandidates.length });

  try {
    const withDomains = rawCandidates.filter(
      (candidate): candidate is { name: string; domain: string } => Boolean(candidate.domain)
    );

    const ranked = await structuredCall(
      STAGE,
      "You rank competitor candidates for relevance against the user's company. Dedupe aggressively and return no more than five competitors with real domains.",
      `User company:
${JSON.stringify(userCompany, null, 2)}

Candidates:
${JSON.stringify(withDomains, null, 2)}

Return the top 5 as a JSON array of { "name": string, "domain": string }.`,
      RankedCompetitorsSchema
    );

    logger.stageComplete(STAGE, "competitors ranked", {
      durationMs: Date.now() - start,
      selected: ranked.length
    });
    return ranked;
  } catch (error) {
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}
