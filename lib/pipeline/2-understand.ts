import { logger } from "@/lib/clients/logger";
import { jsonCall } from "@/lib/clients/llm";
import { repairCompanyProfile } from "@/lib/clients/normalize-json";
import { emitPipelineNotice } from "@/lib/pipeline/notices";
import { haltMessage, siteKindHint, type SiteKind } from "@/lib/pipeline/classify-site";
import { compactSourceText } from "@/lib/readable-scrape";
import { type CompanyProfile } from "@/lib/types";

const STAGE = "Stage2-UnderstandCompany";

export interface UnderstandResult {
  siteKind: SiteKind;
  reason: string;
  profile: CompanyProfile | null;
  haltMessage?: string;
}

export async function understandCompany(
  rawContent: string,
  companyUrl: string,
  options?: { knownName?: string }
): Promise<UnderstandResult> {
  const start = Date.now();
  const domain = new URL(normalizeUrl(companyUrl)).hostname.replace(/^www\./, "");
  const hint = siteKindHint(companyUrl);
  logger.stageStart(STAGE, "classifying page and extracting a company profile", {
    domain,
    urlHint: hint.hint
  });

  if (hint.hint === "personal_profile" || hint.hint === "not_a_company") {
    const siteKind = hint.hint;
    const reason = hint.note;
    logger.stageComplete(STAGE, "page classified from URL heuristic", {
      durationMs: Date.now() - start,
      siteKind
    });
    return { siteKind, reason, profile: null, haltMessage: haltMessage(siteKind, reason) };
  }

  const fallback = scrapeFallbackProfile(rawContent, domain, options?.knownName);
  let siteKind: SiteKind = "company";
  let reason = options?.knownName
    ? `${options.knownName} is in the company database; using the scraped page for the profile.`
    : "Built a company profile from the scraped page because the model did not return a complete schema.";
  let profile: CompanyProfile | null = fallback;

  try {
    const raw = await jsonCall(
      STAGE,
      "You classify a scraped page and extract a company profile. Return one JSON object. Do not invent people like John Doe. Use the real organization name from the page.",
      `Domain: ${domain}
URL: ${companyUrl}
Known name: ${options?.knownName ?? "unknown"}

Website content:
${rawContent.slice(0, 12_000)}

Return:
{
  "siteKind": "company",
  "reason": "short evidence",
  "profile": {
    "name": "organization name",
    "domain": "${domain}",
    "category": "short category",
    "offeringsSummary": "2-3 sentences from the page",
    "searchIntentPhrase": "industry phrase without the company name",
    "founders": [],
    "stats": {
      "dataAvailability": { "funding": false, "revenue": false, "employeeCount": false }
    }
  }
}`
    );

    const parsed = hydrateUnderstand(raw, domain, fallback);
    if (parsed) {
      siteKind = parsed.siteKind;
      reason = parsed.reason;
      profile = parsed.profile;
    } else {
      emitPipelineNotice(STAGE, "The model reply was incomplete. Using the scrape for the company profile.");
      logger.stageWarn(STAGE, "LLM understand incomplete; using scrape fallback", { domain });
    }
  } catch (error) {
    emitPipelineNotice(
      STAGE,
      `Understand model call failed (${error instanceof Error ? error.message : "model error"}). Using the scrape instead.`
    );
    logger.stageWarn(STAGE, "LLM understand failed; using scrape fallback", {
      domain,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (siteKind !== "company") {
    logger.stageComplete(STAGE, "page classified", {
      durationMs: Date.now() - start,
      siteKind
    });
    return {
      siteKind,
      reason,
      profile: null,
      haltMessage: haltMessage(siteKind, reason)
    };
  }

  const resolved = profile ?? fallback;
  logger.stageComplete(STAGE, "page classified", {
    durationMs: Date.now() - start,
    siteKind,
    name: resolved.name,
    domain: resolved.domain,
    fromFallback: profile === fallback
  });
  return { siteKind: "company", reason, profile: resolved };
}

function hydrateUnderstand(
  raw: unknown,
  domain: string,
  fallback: CompanyProfile
): { siteKind: SiteKind; reason: string; profile: CompanyProfile | null } | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const siteKind = asSiteKind(record.siteKind);
  const reason =
    (typeof record.reason === "string" && record.reason.trim()) ||
    "Classified from the scraped page.";

  if (siteKind && siteKind !== "company") {
    return { siteKind, reason, profile: null };
  }

  const repaired = repairCompanyProfile(record.profile ?? record);
  const name = repaired?.name && !isDummyName(repaired.name) ? repaired.name : fallback.name;
  const offerings =
    repaired?.offeringsSummary && !isDummyCopy(repaired.offeringsSummary)
      ? repaired.offeringsSummary
      : fallback.offeringsSummary;

  return {
    siteKind: "company",
    reason,
    profile: {
      name,
      domain,
      category:
        repaired?.category && repaired.category !== "company" ? String(repaired.category) : fallback.category,
      offeringsSummary: offerings,
      searchIntentPhrase:
        (typeof repaired?.searchIntentPhrase === "string" && repaired.searchIntentPhrase) ||
        fallback.searchIntentPhrase,
      founders: Array.isArray(repaired?.founders)
        ? repaired.founders.filter((entry): entry is string => typeof entry === "string")
        : fallback.founders,
      stats: {
        fundingTotal: asOptionalString(repaired?.stats, "fundingTotal"),
        employeeCount: asOptionalString(repaired?.stats, "employeeCount"),
        revenueEstimate: asOptionalString(repaired?.stats, "revenueEstimate"),
        foundedYear: asYear(repaired?.stats),
        dataAvailability: {
          funding: Boolean(asOptionalString(repaired?.stats, "fundingTotal")),
          revenue: Boolean(asOptionalString(repaired?.stats, "revenueEstimate")),
          employeeCount: Boolean(asOptionalString(repaired?.stats, "employeeCount"))
        }
      }
    }
  };
}

function scrapeFallbackProfile(rawContent: string, domain: string, knownName?: string): CompanyProfile {
  const excerpt = compactSourceText(rawContent, 500) || `${domain} was scraped successfully.`;
  const heading = firstHeading(rawContent);
  const name = knownName || heading || titleFromDomain(domain);
  return {
    name,
    domain,
    category: "company",
    offeringsSummary: excerpt.slice(0, 800),
    searchIntentPhrase: `${name} competitors`,
    stats: {
      dataAvailability: { funding: false, revenue: false, employeeCount: false }
    }
  };
}

function firstHeading(raw: string): string | undefined {
  const match = raw.match(/^#\s+(.+)$/m);
  const heading = match?.[1]?.trim();
  if (!heading || heading.length > 80) {
    return undefined;
  }
  return heading.replace(/\s+/g, " ");
}

function titleFromDomain(domain: string): string {
  const stem = domain.split(".")[0] ?? domain;
  return stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function asSiteKind(value: unknown): SiteKind | null {
  if (value === "company" || value === "personal_profile" || value === "not_a_company") {
    return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asOptionalString(stats: unknown, key: string): string | undefined {
  if (!stats || typeof stats !== "object") {
    return undefined;
  }
  const value = (stats as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asYear(stats: unknown): number | undefined {
  if (!stats || typeof stats !== "object") {
    return undefined;
  }
  const value = (stats as Record<string, unknown>).foundedYear;
  return typeof value === "number" && value > 1800 && value < 2100 ? Math.trunc(value) : undefined;
}

function isDummyName(name: string): boolean {
  return /^(john doe|jane doe|acme|example company|test company)$/i.test(name.trim());
}

function isDummyCopy(text: string): boolean {
  return /lorem ipsum|john doe|example\.com/i.test(text);
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
