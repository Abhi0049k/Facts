import { z } from "zod";
import { failStage, logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { type CompanyProfile } from "@/lib/types";

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
${rawContent.slice(0, 24_000)}

Return a JSON object with exactly these keys:
{
  "name": "string",
  "domain": "${domain}",
  "category": "string",
  "offeringsSummary": "string",
  "searchIntentPhrase": "string — industry/business-model phrase, no company name",
  "founders": ["string"] ,
  "stats": {
    "fundingTotal": "string optional",
    "employeeCount": "string optional",
    "revenueEstimate": "string optional",
    "foundedYear": 2020,
    "dataAvailability": { "funding": false, "revenue": false, "employeeCount": false }
  }
}
Omit optional stats and founders when the website does not support them. Never invent numbers.`,
      CompanyProfileSchema
    );

    logger.stageComplete(STAGE, "company profile extracted", {
      durationMs: Date.now() - start,
      name: profile.name,
      domain: profile.domain,
      category: profile.category,
      searchIntentPhrase: profile.searchIntentPhrase
    });
    return profile;
  } catch (error) {
    failStage(STAGE, error, { domain, contentChars: rawContent.length });
  }
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
