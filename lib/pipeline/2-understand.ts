import { z } from "zod";
import { failStage, logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { haltMessage, siteKindHint, type SiteKind } from "@/lib/pipeline/classify-site";
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

const UnderstandSchema = z.object({
  siteKind: z.enum(["company", "personal_profile", "not_a_company"]),
  reason: z.string(),
  profile: CompanyProfileSchema.nullable()
});

export interface UnderstandResult {
  siteKind: SiteKind;
  reason: string;
  profile: CompanyProfile | null;
  haltMessage?: string;
}

export async function understandCompany(
  rawContent: string,
  companyUrl: string
): Promise<UnderstandResult> {
  const start = Date.now();
  const domain = new URL(normalizeUrl(companyUrl)).hostname.replace(/^www\./, "");
  const hint = siteKindHint(companyUrl);
  logger.stageStart(STAGE, "classifying page and extracting a company profile", {
    domain,
    urlHint: hint.hint
  });

  try {
    const result = await structuredCall(
      STAGE,
      `You classify a scraped page, then extract a company profile only when it is a business.

siteKind must be one of:
- company: an organization that sells a product or service, a startup, a school as a business, or a LinkedIn company page.
- personal_profile: a person's resume, portfolio, blog-about-me, LinkedIn /in/ page, or social profile.
- not_a_company: news articles, Wikipedia, search engines, empty parking pages, documentation with no vendor, or unrelated content.

If siteKind is not company, set profile to null. Do not invent a business just to fill the schema.
If siteKind is company, fill profile from evidence on the page. Omit optional stats when evidence is missing. Never fabricate founders, funding, revenue, employee count, or founding year.`,
      `Domain: ${domain}
URL: ${companyUrl}
URL heuristic: ${hint.hint}. ${hint.note}

Website content:
${rawContent.slice(0, 24_000)}

Return JSON:
{
  "siteKind": "company" | "personal_profile" | "not_a_company",
  "reason": "one or two sentences citing page evidence",
  "profile": null or {
    "name": "string",
    "domain": "${domain}",
    "category": "string",
    "offeringsSummary": "string",
    "searchIntentPhrase": "industry or business-model phrase, no company name",
    "founders": ["string"],
    "stats": {
      "fundingTotal": "string optional",
      "employeeCount": "string optional",
      "revenueEstimate": "string optional",
      "foundedYear": 2020,
      "dataAvailability": { "funding": false, "revenue": false, "employeeCount": false }
    }
  }
}`,
      UnderstandSchema
    );

    const siteKind = result.siteKind;
    const reason = result.reason.trim() || "The model did not explain the classification.";
    let profile = result.profile;

    if (siteKind === "company") {
      if (!profile) {
        throw new Error("The model marked this as a company but returned no profile.");
      }
      profile = { ...profile, domain };
    } else {
      profile = null;
    }

    logger.stageComplete(STAGE, "page classified", {
      durationMs: Date.now() - start,
      siteKind,
      name: profile?.name,
      domain: profile?.domain
    });

    if (siteKind !== "company") {
      return {
        siteKind,
        reason,
        profile: null,
        haltMessage: haltMessage(siteKind, reason)
      };
    }

    return { siteKind, reason, profile };
  } catch (error) {
    failStage(STAGE, error, { domain, contentChars: rawContent.length });
  }
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
