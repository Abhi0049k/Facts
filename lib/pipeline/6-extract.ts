import { z } from "zod";
import { failStage, logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { type CompanyProfile, type CompetitorScrapeResult } from "@/lib/types";

const STAGE = "Stage6-ExtractCompetitorProfiles";

const CompanyProfileSchema = z.object({
  name: z.string(),
  domain: z.string(),
  category: z.string(),
  offeringsSummary: z.string(),
  founders: z.array(z.string()).optional(),
  stats: z.object({
    fundingTotal: z.string().optional(),
    employeeCount: z.string().optional(),
    revenueEstimate: z.string().optional(),
    foundedYear: z.number().int().optional(),
    dataAvailability: z.object({
      funding: z.boolean(),
      revenue: z.boolean(),
      employeeCount: z.boolean()
    })
  })
});

const CompanyProfilesSchema = z.array(CompanyProfileSchema);

export async function extractCompetitorProfiles(
  scrapeResults: CompetitorScrapeResult[]
): Promise<CompanyProfile[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "extracting competitor profiles", { competitors: scrapeResults.length });

  try {
    const profiles = await structuredCall(
      STAGE,
      "You extract structured company profiles from scraped competitor source content. Omit optional fields when evidence is unavailable. Never fabricate unavailable funding, revenue, employee count, founders, or founding year.",
      `Extract one CompanyProfile object for each competitor in the supplied array.

Prefer Crunchbase/Tracxn-style content for funding, LinkedIn content for employee count, and Tofler/MCA-style content for revenue. Set dataAvailability booleans based only on available evidence.

Competitor scrape results:
${JSON.stringify(scrapeResults, null, 2)}`,
      CompanyProfilesSchema
    );

    logger.stageComplete(STAGE, "competitor profiles extracted", {
      durationMs: Date.now() - start,
      profiles: profiles.length,
      names: profiles.map((profile) => profile.name)
    });
    return profiles;
  } catch (error) {
    failStage(STAGE, error, { competitors: scrapeResults.length });
  }
}
