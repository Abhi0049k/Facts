import { failStage, logger } from "@/lib/clients/logger";
import { jsonCall } from "@/lib/clients/llm";
import { compactSourceText } from "@/lib/readable-scrape";
import { type CompanyProfile, type CompetitorScrapeResult } from "@/lib/types";

const STAGE = "Stage6-ExtractCompetitorProfiles";

export async function extractCompetitorProfiles(
  scrapeResults: CompetitorScrapeResult[],
  onProgress?: (message: string) => void | Promise<void>
): Promise<CompanyProfile[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "extracting competitor profiles", { competitors: scrapeResults.length });

  try {
    const profiles: CompanyProfile[] = [];

    for (const result of scrapeResults) {
      await onProgress?.(
        `Extracting ${result.competitor.name}. If the model returns extra fields, Facts will still build a profile.`
      );
      const profile = await extractOne(result, onProgress);
      profiles.push(profile);
    }

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

async function extractOne(
  result: CompetitorScrapeResult,
  onProgress?: (message: string) => void | Promise<void>
): Promise<CompanyProfile> {
  const compact = compactForModel(result);
  try {
    const raw = await jsonCall(
      STAGE,
      "You extract one company profile from scrape text. Return one JSON object. Never copy nested crunchbase or linkedin blobs. Never invent funding, revenue, or headcount.",
      `Company: ${result.competitor.name} (${result.competitor.domain})

Sources:
${JSON.stringify(compact)}

Return exactly:
{
  "name": "${result.competitor.name}",
  "domain": "${result.competitor.domain}",
  "category": "short category",
  "offeringsSummary": "2-3 sentences from the sources",
  "founders": [],
  "stats": {
    "fundingTotal": "only if sourced",
    "employeeCount": "only if sourced",
    "revenueEstimate": "only if sourced",
    "foundedYear": 2014,
    "dataAvailability": { "funding": false, "revenue": false, "employeeCount": false }
  }
}`
    );
    const profile = hydrateProfile(raw, result);
    if (profile) {
      return profile;
    }
    await onProgress?.(
      `The model reply for ${result.competitor.name} did not match the profile shape. Using the scrape instead.`
    );
    logger.stageWarn(STAGE, "using scrape fallback profile", { name: result.competitor.name });
    return fallbackProfile(result);
  } catch (error) {
    await onProgress?.(
      `Extract for ${result.competitor.name} failed (${error instanceof Error ? error.message : "model error"}). Using the scrape instead.`
    );
    logger.stageWarn(STAGE, "extract one failed, using scrape fallback", {
      name: result.competitor.name,
      error: error instanceof Error ? error.message : String(error)
    });
    return fallbackProfile(result);
  }
}

function hydrateProfile(raw: unknown, result: CompetitorScrapeResult): CompanyProfile | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const nested = {
    ...asRecord(record.crunchbase),
    ...asRecord(record.linkedin),
    ...record
  };

  const name = pickString(nested, ["name", "company", "company_name"]) || result.competitor.name;
  const domain =
    firstHost(pickString(nested, ["domain", "website", "url"])) || result.competitor.domain;
  const offerings =
    pickString(nested, ["offeringsSummary", "offerings", "full_description", "description", "about"]) ||
    compactSourceText(result.sources.website, 400) ||
    `${name} operates at ${domain}.`;
  const category = pickString(nested, ["category", "type", "industry"]) || "company";
  const employee =
    pickString(nested, ["employeeCount", "employees_in_linkedin", "employees"]) ||
    (typeof nested.employees_in_linkedin === "number" ? String(nested.employees_in_linkedin) : undefined);
  const funding = pickString(nested, ["fundingTotal", "funding", "total_funding"]);
  const revenue = pickString(nested, ["revenueEstimate", "revenue"]);
  const founded = asYear(nested.foundedYear ?? nested.founded_year ?? nested.founded);

  return {
    name,
    domain,
    category,
    offeringsSummary: offerings.slice(0, 800),
    founders: Array.isArray(nested.founders)
      ? nested.founders.filter((item): item is string => typeof item === "string")
      : undefined,
    stats: {
      fundingTotal: funding,
      employeeCount: employee,
      revenueEstimate: revenue,
      foundedYear: founded,
      dataAvailability: {
        funding: Boolean(funding),
        revenue: Boolean(revenue),
        employeeCount: Boolean(employee)
      }
    }
  };
}

function fallbackProfile(result: CompetitorScrapeResult): CompanyProfile {
  const fromPage = compactSourceText(result.sources.website, 420);
  const fromCb = compactSourceText(result.sources.crunchbase, 280);
  return {
    name: result.competitor.name,
    domain: result.competitor.domain,
    category: "company",
    offeringsSummary: fromPage || fromCb || `${result.competitor.name} was scraped at ${result.competitor.domain}.`,
    stats: {
      dataAvailability: { funding: false, revenue: false, employeeCount: false }
    }
  };
}

function compactForModel(result: CompetitorScrapeResult) {
  return {
    name: result.competitor.name,
    domain: result.competitor.domain,
    website: compactSourceText(result.sources.website, 1800),
    crunchbase: compactSourceText(result.sources.crunchbase, 900),
    linkedin: compactSourceText(result.sources.linkedin, 900)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (Array.isArray(value) && value[0] && typeof value[0] === "object") {
      return value[0] as Record<string, unknown>;
    }
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function firstHost(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const host = new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "");
    return host || undefined;
  } catch {
    return value.replace(/^www\./, "") || undefined;
  }
}

function asYear(value: unknown): number | undefined {
  if (typeof value === "number" && value > 1800 && value < 2100) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const match = value.match(/\b(19|20)\d{2}\b/);
    if (match) {
      return Number(match[0]);
    }
  }
  return undefined;
}
