import { failStage, logger } from "@/lib/clients/logger";
import { jsonCall } from "@/lib/clients/llm";
import { tavilySearchCompanyMetrics } from "@/lib/clients/tavily";
import { compactSourceText } from "@/lib/readable-scrape";
import { enrichCompanyProfile, applyEnrichmentToProfile, type CompetitorScrapeResult } from "./enrichment";
import { type CompanyProfile } from "@/lib/types";

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
  let searchSnippets = "";
  if (process.env.TAVILY_API_KEY?.trim()) {
    try {
      const searchResults = await tavilySearchCompanyMetrics(result.competitor.name, result.competitor.domain);
      if (searchResults.length > 0) {
        searchSnippets = searchResults
          .map((r) => `${r.title}: ${r.content}`)
          .join("\n")
          .slice(0, 1500);
      }
    } catch (err) {
      logger.stageWarn(STAGE, "Tavily metrics search fallback failed", {
        name: result.competitor.name,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const baseProfile = await extractBaseProfile(result);
  const enrichment = enrichCompanyProfile(result.competitor.name, result.sources, searchSnippets);
  const enrichedProfile = applyEnrichmentToProfile(baseProfile, enrichment);

  logger.debug(STAGE, "profile enrichment applied", {
    name: result.competitor.name,
    funding: enrichment.funding,
    employees: enrichment.employees,
    revenue: enrichment.revenue,
    founded: enrichment.founded,
  });

  return enrichedProfile;
}

async function extractBaseProfile(result: CompetitorScrapeResult): Promise<CompanyProfile> {
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
    logger.stageWarn(STAGE, "using scrape fallback profile", { name: result.competitor.name });
    return fallbackProfile(result);
  } catch (error) {
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

  const name = pickString(record, ["name", "company", "company_name"]) || result.competitor.name;
  const domain =
    firstHost(pickString(record, ["domain", "website", "url"])) || result.competitor.domain;
  const offerings =
    pickString(record, ["offeringsSummary", "offerings", "full_description", "description", "about"]) ||
    compactSourceText(result.sources.website, 400) ||
    `${name} operates at ${domain}.`;
  const category = pickString(record, ["category", "type", "industry"]) || "company";
  const founders = Array.isArray(record.founders)
    ? record.founders.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    name,
    domain,
    category,
    offeringsSummary: offerings.slice(0, 800),
    founders,
    stats: {
      fundingTotal: undefined,
      employeeCount: undefined,
      revenueEstimate: undefined,
      foundedYear: undefined,
      dataAvailability: {
        funding: false,
        revenue: false,
        employeeCount: false
      }
    }
  };
}

function fallbackProfile(result: CompetitorScrapeResult): CompanyProfile {
  const parsedSources = parseScrapedSources(result.sources);
  const enrichment = enrichCompanyProfile(result.competitor.name, result.sources, undefined);

  const fromPage = compactSourceText(result.sources.website, 420);
  const fromCb = compactSourceText(result.sources.crunchbase, 280);

  return applyEnrichmentToProfile({
    name: result.competitor.name,
    domain: result.competitor.domain,
    category: "company",
    offeringsSummary: fromPage || fromCb || `${result.competitor.name} was scraped at ${result.competitor.domain}.`,
    stats: {
      dataAvailability: { funding: false, revenue: false, employeeCount: false }
    }
  }, enrichment);
}

function parseScrapedSources(sources: CompetitorScrapeResult["sources"]) {
  function tryParse(text: string | null) {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return {
    linkedin: tryParse(sources.linkedin),
    crunchbase: tryParse(sources.crunchbase),
    website: tryParse(sources.website),
    tofler: tryParse(sources.tofler),
    tracxn: tryParse(sources.tracxn),
  };
}

function compactForModel(result: CompetitorScrapeResult) {
  const parsed = parseScrapedSources(result.sources);
  
  const linkedinSummary = parsed.linkedin 
    ? summarizeLinkedIn(parsed.linkedin)
    : compactSourceText(result.sources.linkedin, 900);
  
  const crunchbaseSummary = parsed.crunchbase
    ? summarizeCrunchbase(parsed.crunchbase)
    : compactSourceText(result.sources.crunchbase, 900);

  return {
    name: result.competitor.name,
    domain: result.competitor.domain,
    website: compactSourceText(result.sources.website, 1800),
    crunchbase: crunchbaseSummary,
    linkedin: linkedinSummary
  };
}

function summarizeLinkedIn(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.about) parts.push(`About: ${String(data.about).slice(0, 500)}`);
  if (data.company_size) parts.push(`Size: ${data.company_size}`);
  if (data.employees_in_linkedin) parts.push(`Employees (LinkedIn): ${data.employees_in_linkedin}`);
  if (data.followers) parts.push(`Followers: ${data.followers}`);
  if (data.industry) parts.push(`Industry: ${data.industry}`);
  if (data.headquarters) parts.push(`HQ: ${data.headquarters}`);
  if (data.founded_year) parts.push(`Founded: ${data.founded_year}`);
  if (data.specialties) parts.push(`Specialties: ${data.specialties}`);
  return parts.join(" | ") || "LinkedIn data available";
}

function summarizeCrunchbase(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.description) parts.push(`Description: ${String(data.description).slice(0, 500)}`);
  if (data.funding_total) parts.push(`Total Funding: ${data.funding_total}`);
  if (data.funding_stage) parts.push(`Funding Stage: ${data.funding_stage}`);
  if (data.num_employees_enum) parts.push(`Employees: ${data.num_employees_enum}`);
  if (data.founded_on) parts.push(`Founded: ${data.founded_on}`);
  if (data.categories) parts.push(`Categories: ${Array.isArray(data.categories) ? data.categories.join(", ") : data.categories}`);
  if (data.investors) parts.push(`Investors: ${Array.isArray(data.investors) ? data.investors.join(", ") : data.investors}`);
  return parts.join(" | ") || "Crunchbase data available";
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

function pickString(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;
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