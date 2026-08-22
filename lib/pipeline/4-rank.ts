import { z } from "zod";
import { failStage, logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { type CompanyProfile } from "@/lib/types";

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

    logger.stageComplete(STAGE, "top competitors selected", {
      durationMs: Date.now() - start,
      selected: ranked.length,
      ranked: ranked.map((item) => ({ name: item.name, domain: item.domain }))
    });
    return ranked;
  } catch (error) {
    failStage(STAGE, error, { candidateCount: rawCandidates.length });
  }
}
