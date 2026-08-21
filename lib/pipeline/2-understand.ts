import { z } from "zod";
import { logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { PipelineStageError, type CompanyProfile } from "@/lib/types";

const STAGE = "Stage2-UnderstandCompany";

const CompanyProfileSchema = z.object({
  name: z.string(),
  domain: z.string(),
  category: z.string(),
  offeringsSummary: z.string(),
  searchIntentPhrase: z.string(),
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

export async function understandCompany(
  rawContent: string,
  companyUrl: string
): Promise<CompanyProfile> {
  const start = Date.now();
  const domain = new URL(normalizeUrl(companyUrl)).hostname.replace(/^www\./, "");
  logger.stageStart(STAGE, "understanding company", { domain });

  try {
    const profile = await structuredCall(
      STAGE,
      "You are analyzing a company's scraped website content to produce a structured business profile. Omit optional stats when evidence is unavailable; do not fabricate founders, funding, revenue, employee count, or founding year.",
      `Domain: ${domain}

Website content:
${rawContent}

Extract: company name, domain, category/segment, offerings summary, optional founders, optional available stats, data availability flags, and a generic industry-framed searchIntentPhrase describing the business model for competitor discovery. The searchIntentPhrase must not include the company's own name.`,
      CompanyProfileSchema
    );

    logger.stageComplete(STAGE, "understanding company", { durationMs: Date.now() - start });
    return profile;
  } catch (error) {
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
