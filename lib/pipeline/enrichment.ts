import { logger } from "@/lib/clients/logger";
import type { CompanyProfile } from "@/lib/types";

export interface ScrapedSourceContent {
  website: string | null;
  crunchbase: string | null;
  tracxn: string | null;
  linkedin: string | null;
  tofler: string | null;
}

export interface CompetitorScrapeResult {
  competitor: { name: string; domain: string };
  sources: ScrapedSourceContent;
}

export interface EnrichedField<T> {
  value: T | null;
  source: string | null;
  status: "resolved" | "not_found" | "parse_failed" | "source_unavailable";
}

export interface CompanyEnrichment {
  companyName: string;
  funding: EnrichedField<string>;
  employees: EnrichedField<number | string>;
  revenue: EnrichedField<string>;
  founded: EnrichedField<number>;
}

interface ParsedSourceData {
  linkedin?: Record<string, unknown> | null;
  crunchbase?: Record<string, unknown> | null;
  website?: Record<string, unknown> | null;
  tofler?: Record<string, unknown> | null;
  tracxn?: Record<string, unknown> | null;
}

function tryParseJson(text: string | null): Record<string, unknown> | null {
  if (!text || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function extractParsedSources(sources: CompetitorScrapeResult["sources"]): ParsedSourceData {
  const parsed = {
    linkedin: tryParseJson(sources.linkedin),
    crunchbase: tryParseJson(sources.crunchbase),
    website: tryParseJson(sources.website),
    tofler: tryParseJson(sources.tofler),
    tracxn: tryParseJson(sources.tracxn),
  };
  logger.debug("Enrichment", "parsed sources", {
    linkedin: parsed.linkedin ? Object.keys(parsed.linkedin) : null,
    crunchbase: parsed.crunchbase ? Object.keys(parsed.crunchbase) : null,
    website: parsed.website ? Object.keys(parsed.website) : null,
    tofler: parsed.tofler ? Object.keys(parsed.tofler) : null,
    tracxn: parsed.tracxn ? Object.keys(parsed.tracxn) : null,
  });
  return parsed;
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown> | null | undefined, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const num = Number(value.replace(/[,\s]/g, ""));
      if (Number.isFinite(num)) return num;
    }
  }
  return undefined;
}

function extractYear(obj: Record<string, unknown> | null | undefined, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && value > 1800 && value < 2100) return Math.trunc(value);
    if (typeof value === "string") {
      const match = value.match(/\b(19|20)\d{2}\b/);
      if (match) return Number(match[0]);
    }
  }
  return undefined;
}

function extractEmployees(obj: Record<string, unknown> | null | undefined): { value: number | string; source: string } | null {
  if (!obj) return null;

  const exact = pickNumber(obj, ["employees_in_linkedin", "employee_count", "headcount", "employees"]);
  if (exact !== undefined) return { value: exact, source: "linkedin" };

  const sizeStr = pickString(obj, ["company_size", "size", "employee_range"]);
  if (sizeStr) return { value: sizeStr, source: "linkedin" };

  return null;
}

function extractFunding(obj: Record<string, unknown> | null | undefined): { value: string; source: string } | null {
  if (!obj) return null;
  const funding = pickString(obj, ["funding_total", "total_funding", "funding", "raised", "investment"]);
  if (funding) return { value: funding, source: "crunchbase" };
  return null;
}

function extractRevenue(obj: Record<string, unknown> | null | undefined): { value: string; source: string } | null {
  if (!obj) return null;
  const revenue = pickString(obj, ["revenue", "annual_revenue", "revenue_estimate", "arr"]);
  if (revenue) return { value: revenue, source: "crunchbase" };
  return null;
}

function extractFounded(obj: Record<string, unknown> | null | undefined): { value: number; source: string } | null {
  if (!obj) return null;
  const year = extractYear(obj, ["founded_year", "founded", "year_founded", "incorporation_year"]);
  if (year) return { value: year, source: "crunchbase" };
  return null;
}

function resolveFromParsedSources(parsed: ParsedSourceData): Partial<CompanyEnrichment> {
  const result: Partial<CompanyEnrichment> = {};

  const allSources = [
    { data: parsed.linkedin, prefix: "linkedin" },
    { data: parsed.crunchbase, prefix: "crunchbase" },
    { data: parsed.website, prefix: "website" },
    { data: parsed.tofler, prefix: "tofler" },
    { data: parsed.tracxn, prefix: "tracxn" },
  ].filter((s) => s.data);

  for (const { data, prefix } of allSources) {
    const emp = extractEmployees(data);
    if (emp && !result.employees) {
      result.employees = {
        value: emp.value,
        source: emp.source,
        status: "resolved",
      };
    }

    const funding = extractFunding(data);
    if (funding && !result.funding) {
      result.funding = {
        value: funding.value,
        source: funding.source,
        status: "resolved",
      };
    }

    const revenue = extractRevenue(data);
    if (revenue && !result.revenue) {
      result.revenue = {
        value: revenue.value,
        source: revenue.source,
        status: "resolved",
      };
    }

    const founded = extractFounded(data);
    if (founded && !result.founded) {
      result.founded = {
        value: founded.value,
        source: founded.source,
        status: "resolved",
      };
    }
  }

  logger.debug("Enrichment", "resolved from sources", result);
  return result;
}

function normalizeTavilySnippets(snippets: string): Record<string, unknown> | null {
  if (!snippets || !snippets.trim()) return null;

  const result: Record<string, unknown> = {};

  const fundingMatch = snippets.match(/(?:funding|raised|investment)[^\d]*(\$[\d,.]+[MBK]?)/i);
  if (fundingMatch) result.funding_total = fundingMatch[1];

  const employeesMatch = snippets.match(/(?:employees?|headcount|staff)[^\d]*([\d,]+)/i);
  if (employeesMatch) result.employees_in_linkedin = Number(employeesMatch[1].replace(/,/g, ""));

  const revenueMatch = snippets.match(/(?:revenue|arr|annual revenue)[^\d]*(\$[\d,.]+[MBK]?)/i);
  if (revenueMatch) result.revenue = revenueMatch[1];

  const foundedMatch = snippets.match(/(?:founded|established|incorporated)[^\d]*\b(19|20)\d{2}\b/i);
  if (foundedMatch) result.founded_year = Number(foundedMatch[0].match(/\b(19|20)\d{2}\b/)?.[0]);

  return Object.keys(result).length > 0 ? result : null;
}

function createEnrichedField<T>(value: T | null | undefined, source: string | null, resolved: boolean): EnrichedField<T> {
  return {
    value: value ?? null,
    source: resolved ? source : null,
    status: resolved ? "resolved" : "not_found",
  };
}

export function enrichCompanyProfile(
  competitorName: string,
  sources: CompetitorScrapeResult["sources"],
  tavilySnippets?: string
): CompanyEnrichment {
  logger.stageWarn("Enrichment", "enrichCompanyProfile called", { competitorName, hasTavily: Boolean(tavilySnippets) });
  const parsed = extractParsedSources(sources);
  const fromSources = resolveFromParsedSources(parsed);

  const fromTavily = tavilySnippets ? normalizeTavilySnippets(tavilySnippets) : null;

  const tavilyFunding = fromTavily?.funding_total as string | undefined;
  const tavilyEmployees = fromTavily?.employees_in_linkedin as number | string | undefined;
  const tavilyRevenue = fromTavily?.revenue as string | undefined;
  const tavilyFounded = fromTavily?.founded_year as number | undefined;

  const enrichment: CompanyEnrichment = {
    companyName: competitorName,
    funding: createEnrichedField<string>(fromSources.funding?.value ?? tavilyFunding ?? null, 
      fromSources.funding?.source ?? (tavilyFunding ? "tavily" : null),
      Boolean(fromSources.funding?.value ?? tavilyFunding)),
    employees: createEnrichedField<number | string>(fromSources.employees?.value ?? tavilyEmployees ?? null,
      fromSources.employees?.source ?? (tavilyEmployees ? "tavily" : null),
      Boolean(fromSources.employees?.value ?? tavilyEmployees)),
    revenue: createEnrichedField<string>(fromSources.revenue?.value ?? tavilyRevenue ?? null,
      fromSources.revenue?.source ?? (tavilyRevenue ? "tavily" : null),
      Boolean(fromSources.revenue?.value ?? tavilyRevenue)),
    founded: createEnrichedField<number>(fromSources.founded?.value ?? tavilyFounded ?? null,
      fromSources.founded?.source ?? (tavilyFounded ? "tavily" : null),
      Boolean(fromSources.founded?.value ?? tavilyFounded)),
  };

  logger.debug("Enrichment", "company enrichment resolved", {
    company: competitorName,
    funding: enrichment.funding,
    employees: enrichment.employees,
    revenue: enrichment.revenue,
    founded: enrichment.founded,
  });

  return enrichment;
}

export function applyEnrichmentToProfile(
  profile: CompanyProfile,
  enrichment: CompanyEnrichment
): CompanyProfile {
  logger.stageWarn("Enrichment", "applyEnrichmentToProfile called", { 
    name: profile.name, 
    funding: enrichment.funding, 
    employees: enrichment.employees 
  });
  return {
    ...profile,
    stats: {
      ...profile.stats,
      fundingTotal: enrichment.funding.value ?? profile.stats.fundingTotal,
      employeeCount: enrichment.employees.value !== null ? String(enrichment.employees.value) : profile.stats.employeeCount,
      revenueEstimate: enrichment.revenue.value ?? profile.stats.revenueEstimate,
      foundedYear: enrichment.founded.value ?? profile.stats.foundedYear,
      dataAvailability: {
        funding: Boolean(enrichment.funding.value),
        revenue: Boolean(enrichment.revenue.value),
        employeeCount: Boolean(enrichment.employees.value),
      },
    },
  };
}