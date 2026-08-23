import {
  isUsableSourceId,
  mapPool,
  scrapeMany,
  scrapePage,
  serializeResult,
  slugFromName
} from "@/lib/clients/brightdata";
import { failStage, logger } from "@/lib/clients/logger";
import { prisma } from "@/lib/clients/prisma";
import { normalizeDomain } from "@/lib/normalize-domain";
import { tavilySearch } from "@/lib/clients/tavily";
import { type CompetitorScrapeResult } from "@/lib/types";

const CRUNCHBASE_SOURCE = process.env.BRIGHT_DATA_COLLECTOR_CRUNCHBASE;
const LINKEDIN_SOURCE = process.env.BRIGHT_DATA_COLLECTOR_LINKEDIN;
const TOFLER_SOURCE = process.env.BRIGHT_DATA_COLLECTOR_TOFLER;
const STAGE = "Stage5-ScrapeCompetitors";
const PAGE_CONCURRENCY = 3;

export async function scrapeCompetitors(
  competitors: { name: string; domain: string }[]
): Promise<CompetitorScrapeResult[]> {
  const start = Date.now();
  logger.stageStart(STAGE, `scraping ${competitors.length} competitors`);

  try {
    const knownSources = await mapPool(competitors, PAGE_CONCURRENCY, loadKnownSources);
    const websites = await mapPool(competitors.map((competitor, index) => ({ competitor, index })), PAGE_CONCURRENCY, async ({ competitor, index }) => {
      const websiteUrl = knownSources[index]?.websiteUrl ?? `https://${competitor.domain.replace(/^https?:\/\//, "")}`;
      logger.debug(STAGE, `scraping website ${competitor.name}`, { domain: competitor.domain, websiteUrl });
      return scrapePage(websiteUrl);
    });

    const crunchbaseByIndex = await scrapeResolvedSource(
      competitors,
      knownSources.map((source) => source.profileUrls.crunchbase),
      CRUNCHBASE_SOURCE,
      "crunchbase",
      (competitor) => `https://www.crunchbase.com/organization/${slugFromName(competitor.name)}`
    );
    const linkedinByIndex = await scrapeResolvedSource(
      competitors,
      knownSources.map((source) => source.profileUrls.linkedin),
      LINKEDIN_SOURCE,
      "linkedin",
      (competitor) => `https://www.linkedin.com/company/${slugFromName(competitor.name)}`
    );
    const tracxnByIndex = await scrapeResolvedSource(
      competitors,
      knownSources.map((source) => source.profileUrls.tracxn),
      undefined,
      "tracxn",
      (competitor) => `https://tracxn.com/d/companies/${slugFromName(competitor.name)}`
    );
    const toflerByIndex = await scrapeResolvedSource(
      competitors,
      knownSources.map((source) => source.profileUrls.tofler),
      TOFLER_SOURCE,
      "tofler",
      (competitor) => `https://www.tofler.in/${slugFromName(competitor.name)}`
    );

    const results = competitors.map((competitor, index) => {
      const sources = {
        website: websites[index] ?? null,
        crunchbase: crunchbaseByIndex[index] ?? null,
        tracxn: tracxnByIndex[index] ?? null,
        linkedin: linkedinByIndex[index] ?? null,
        tofler: toflerByIndex[index] ?? null
      };

      if (!sources.website && !sources.crunchbase && !sources.linkedin && !sources.tofler) {
        logger.stageWarn(STAGE, `no data for ${competitor.name}, continuing`, {
          domain: competitor.domain
        });
      }

      return { competitor, sources };
    });

    const succeeded = results.filter((result) =>
      Object.values(result.sources).some((source) => source !== null)
    ).length;
    logger.stageComplete(STAGE, "competitor sources scraped", {
      durationMs: Date.now() - start,
      succeeded,
      total: competitors.length,
      sourceHits: results.map((result) => ({
        name: result.competitor.name,
        website: Boolean(result.sources.website),
        crunchbase: Boolean(result.sources.crunchbase),
        tracxn: Boolean(result.sources.tracxn),
        linkedin: Boolean(result.sources.linkedin),
        tofler: Boolean(result.sources.tofler)
      }))
    });

    return results;
  } catch (error) {
    failStage(STAGE, error, { competitorCount: competitors.length });
  }
}

async function scrapeResolvedSource(
  competitors: { name: string; domain: string }[],
  knownUrls: Array<string | undefined>,
  sourceId: string | undefined,
  kind: "crunchbase" | "linkedin" | "tracxn" | "tofler",
  fallbackUrl: (competitor: { name: string; domain: string }) => string
): Promise<(string | null)[]> {
  const urls = await Promise.all(
    competitors.map(async (competitor, index) => {
      if (knownUrls[index]) {
        return knownUrls[index]!;
      }
      const resolved = await resolveProfileUrl(competitor, kind);
      return resolved ?? fallbackUrl(competitor);
    })
  );

  if (!isUsableSourceId(sourceId)) {
    return mapPool(urls, PAGE_CONCURRENCY, async (url) => {
      if (!url) {
        return null;
      }
      return scrapePage(url);
    });
  }

  const rows = await scrapeMany(sourceId, urls);
  return rows.map((row) => serializeResult(row));
}

async function resolveProfileUrl(
  competitor: { name: string; domain: string },
  kind: "crunchbase" | "linkedin" | "tracxn" | "tofler"
): Promise<string | null> {
  const query =
    kind === "crunchbase"
      ? `${competitor.name} ${competitor.domain} site:crunchbase.com/organization`
      : kind === "linkedin"
        ? `${competitor.name} ${competitor.domain} site:linkedin.com/company`
        : kind === "tracxn"
          ? `${competitor.name} ${competitor.domain} site:tracxn.com`
          : `${competitor.name} ${competitor.domain} site:tofler.in`;

  const results = await tavilySearch(query).catch((error) => {
    logger.stageWarn(STAGE, "profile URL search failed", {
      competitor: competitor.name,
      kind,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  });

  for (const result of results) {
    try {
      const parsed = new URL(result.url);
      const host = parsed.hostname.replace(/^www\./, "");
      if (kind === "crunchbase" && host === "crunchbase.com" && parsed.pathname.includes("/organization/")) {
        return parsed.toString();
      }
      if (kind === "linkedin" && host === "linkedin.com" && parsed.pathname.includes("/company/")) {
        return parsed.toString();
      }
      if (kind === "tracxn" && host.endsWith("tracxn.com")) {
        return parsed.toString();
      }
      if (kind === "tofler" && host.endsWith("tofler.in")) {
        return parsed.toString();
      }
    } catch {
      continue;
    }
  }

  logger.debug(STAGE, "no canonical profile URL, using slug fallback", {
    competitor: competitor.name,
    kind
  });
  return null;
}

type KnownCompetitorSources = {
  websiteUrl?: string;
  profileUrls: {
    crunchbase?: string;
    linkedin?: string;
    tracxn?: string;
    tofler?: string;
  };
};

async function loadKnownSources(competitor: { name: string; domain: string }): Promise<KnownCompetitorSources> {
  const empty: KnownCompetitorSources = { profileUrls: {} };
  if (!process.env.DATABASE_URL?.trim()) {
    return empty;
  }

  const domain = normalizeDomain(competitor.domain);
  if (!domain) {
    return empty;
  }

  try {
    const existing = await prisma.company.findUnique({
      where: { primaryDomain: domain },
      include: { sources: true }
    });

    if (!existing) {
      return empty;
    }

    const infoSources = existing.sources.filter((source) => source.sourceCategory === "info");
    const websiteUrl =
      infoSources.find((source) => /own_about_page|official|about|homepage|other/i.test(source.sourceType))?.url ??
      infoSources[0]?.url;

    const profileUrls = {
      crunchbase: findSourceUrl(infoSources, "crunchbase"),
      linkedin: findSourceUrl(infoSources, "linkedin"),
      tracxn: findSourceUrl(infoSources, "tracxn"),
      tofler: findSourceUrl(infoSources, "tofler")
    };

    logger.debug(STAGE, "loaded competitor links from database", {
      competitor: competitor.name,
      domain,
      websiteUrl,
      profileUrls
    });

    return { websiteUrl, profileUrls };
  } catch (error) {
    logger.stageWarn(STAGE, "competitor database source lookup failed", {
      competitor: competitor.name,
      domain,
      error: error instanceof Error ? error.message : String(error)
    });
    return empty;
  }
}

function findSourceUrl(
  sources: Array<{ url: string; sourceType: string }>,
  kind: "crunchbase" | "linkedin" | "tracxn" | "tofler"
): string | undefined {
  return sources.find((source) => {
    const sourceType = source.sourceType.toLowerCase();
    const url = source.url.toLowerCase();
    return sourceType.includes(kind) || url.includes(`${kind}.`);
  })?.url;
}
