import {
  isUsableSourceId,
  mapPool,
  scrapeMany,
  scrapePage,
  serializeResult,
  slugFromName
} from "@/lib/clients/brightdata";
import { logger } from "@/lib/clients/logger";
import { tavilySearch } from "@/lib/clients/tavily";
import { PipelineStageError, type CompetitorScrapeResult } from "@/lib/types";

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
    const websites = await mapPool(competitors, PAGE_CONCURRENCY, async (competitor) => {
      const websiteUrl = `https://${competitor.domain.replace(/^https?:\/\//, "")}`;
      logger.debug(STAGE, `scraping website ${competitor.name}`, { domain: competitor.domain });
      return scrapePage(websiteUrl);
    });

    const crunchbaseByIndex = await scrapeResolvedSource(
      competitors,
      CRUNCHBASE_SOURCE,
      "crunchbase",
      (competitor) => `https://www.crunchbase.com/organization/${slugFromName(competitor.name)}`
    );
    const linkedinByIndex = await scrapeResolvedSource(
      competitors,
      LINKEDIN_SOURCE,
      "linkedin",
      (competitor) => `https://www.linkedin.com/company/${slugFromName(competitor.name)}`
    );
    const toflerByIndex = await scrapeResolvedSource(
      competitors,
      TOFLER_SOURCE,
      "tofler",
      (competitor) => `https://www.tofler.in/${slugFromName(competitor.name)}`
    );

    const results = competitors.map((competitor, index) => {
      const sources = {
        website: websites[index] ?? null,
        crunchbase: crunchbaseByIndex[index] ?? null,
        tracxn: null,
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
    logger.stageComplete(STAGE, `${succeeded}/${competitors.length} competitors scraped`, {
      durationMs: Date.now() - start
    });

    return results;
  } catch (error) {
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}

async function scrapeResolvedSource(
  competitors: { name: string; domain: string }[],
  sourceId: string | undefined,
  kind: "crunchbase" | "linkedin" | "tofler",
  fallbackUrl: (competitor: { name: string; domain: string }) => string
): Promise<(string | null)[]> {
  if (!isUsableSourceId(sourceId)) {
    return competitors.map(() => null);
  }

  const urls = await Promise.all(
    competitors.map(async (competitor) => {
      const resolved = await resolveProfileUrl(competitor, kind);
      return resolved ?? fallbackUrl(competitor);
    })
  );

  const rows = await scrapeMany(sourceId, urls);
  return rows.map((row) => serializeResult(row));
}

async function resolveProfileUrl(
  competitor: { name: string; domain: string },
  kind: "crunchbase" | "linkedin" | "tofler"
): Promise<string | null> {
  const query =
    kind === "crunchbase"
      ? `${competitor.name} ${competitor.domain} site:crunchbase.com/organization`
      : kind === "linkedin"
        ? `${competitor.name} ${competitor.domain} site:linkedin.com/company`
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
