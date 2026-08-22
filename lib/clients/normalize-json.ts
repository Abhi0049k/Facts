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
