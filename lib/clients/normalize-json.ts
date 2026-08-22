import { logger } from "./logger";

const LIST_KEYS = [
  "competitors",
  "candidates",
  "companies",
  "profiles",
  "results",
  "items",
  "data",
  "output",
  "organizations"
];

const NAME_KEYS = ["name", "company", "company_name", "companyName", "title", "org", "organization", "brand"];
const DOMAIN_KEYS = ["domain", "website", "url", "site", "web", "homepage", "link"];

export function asObjectList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of LIST_KEYS) {
    if (Array.isArray(record[key])) {
      logger.debug("LLM", "unwrapped object key to a list", { key });
      return record[key];
    }
  }

  const nestedLists = Object.values(record).filter(Array.isArray);
  if (nestedLists.length === 1) {
    logger.debug("LLM", "unwrapped sole array field to a list");
    return nestedLists[0];
  }

  const keys = Object.keys(record);
  if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
    return Object.values(record);
  }

  logger.debug("LLM", "wrapped single object as a one-item list");
  return [record];
}

export function repairCompanyProfile(item: unknown): Record<string, unknown> | null {
  const record = flattenRecord(item);
  if (!record || "siteKind" in record) {
    return null;
  }

  const name = pickString(record, NAME_KEYS) || stringish(record.name);
  const domain = firstHostname(record, DOMAIN_KEYS) || stringish(record.domain);
  if (!name && !domain) {
    return null;
  }

  const offerings =
    pickString(record, ["offeringsSummary", "offerings", "full_description", "description", "about", "summary"]) ||
    "No offerings summary was returned by the model.";
  const category = pickString(record, ["category", "type", "industry"]) || "company";
  const statsRecord = flattenRecord(record.stats) ?? {};
  const employee =
    pickString({ ...record, ...statsRecord }, ["employeeCount", "employees_in_linkedin", "employees"]) ||
    (typeof record.employees_in_linkedin === "number" ? String(record.employees_in_linkedin) : undefined);
  const funding = pickString({ ...record, ...statsRecord }, [
    "fundingTotal",
    "funding",
    "total_funding",
    "funding_total"
  ]);
  const revenue = pickString({ ...record, ...statsRecord }, ["revenueEstimate", "revenue"]);

  return {
    name: name || domain || "Unknown company",
    domain: domain || "unknown",
    category,
    offeringsSummary: offerings.slice(0, 800),
    founders: Array.isArray(record.founders)
      ? record.founders.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    stats: {
      fundingTotal: funding,
      employeeCount: employee,
      revenueEstimate: revenue,
      foundedYear: asYear(record.foundedYear ?? record.founded_year ?? statsRecord.foundedYear),
      dataAvailability: {
        funding: Boolean(funding),
        revenue: Boolean(revenue),
        employeeCount: Boolean(employee)
      }
    }
  };
}

function flattenRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    return flattenRecord(value[0]);
  }
  const record = value as Record<string, unknown>;
  const nested = [flattenRecord(record.crunchbase), flattenRecord(record.linkedin), flattenRecord(record.website)];
  return Object.assign({}, ...nested.filter(Boolean), record);
}

function stringish(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

export function asCompetitorCandidates(value: unknown): { name: string; domain?: string }[] {
  return asObjectList(value)
    .map(normalizeCandidate)
    .filter((candidate): candidate is { name: string; domain?: string } => Boolean(candidate));
}

function normalizeCandidate(item: unknown): { name: string; domain?: string } | null {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { name } : null;
  }
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  for (const nestedKey of ["competitor", "company", "organization"]) {
    const nested = record[nestedKey];
    if (nested && typeof nested === "object") {
      const fromNested = normalizeCandidate(nested);
      if (fromNested) {
        return fromNested;
      }
    }
  }

  const name = pickString(record, NAME_KEYS);
  if (!name) {
    return null;
  }

  const domain = firstHostname(record, DOMAIN_KEYS);
  return domain ? { name, domain } : { name };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function firstHostname(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const hostname = toHostname(record[key]);
    if (hostname) {
      return hostname;
    }
  }
  return undefined;
}

function toHostname(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return undefined;
  }

  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes(".")) {
      return host;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
