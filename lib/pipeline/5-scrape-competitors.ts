import { scrapeUrl, slugFromName } from "@/lib/clients/brightdata";
import { logger } from "@/lib/clients/logger";
import { PipelineStageError, type CompetitorScrapeResult } from "@/lib/types";

const COMPANY_SITE_COLLECTOR = process.env.BRIGHT_DATA_COLLECTOR_COMPANY_SITE;
const CRUNCHBASE_COLLECTOR = process.env.BRIGHT_DATA_COLLECTOR_CRUNCHBASE;
const LINKEDIN_COLLECTOR = process.env.BRIGHT_DATA_COLLECTOR_LINKEDIN;
const TOFLER_COLLECTOR = process.env.BRIGHT_DATA_COLLECTOR_TOFLER;
const STAGE = "Stage5-ScrapeCompetitors";

export async function scrapeCompetitors(
  competitors: { name: string; domain: string }[]
): Promise<CompetitorScrapeResult[]> {
  const start = Date.now();
  logger.stageStart(STAGE, `scraping ${competitors.length} competitors`);

  try {
    const results = await Promise.all(
      competitors.map(async (competitor) => {
        const slug = slugFromName(competitor.name);
        const websiteUrl = `https://${competitor.domain}`;
        logger.debug(STAGE, `scraping ${competitor.name}`, { domain: competitor.domain });
        const sourceRequests = {
          website: usableCollector(COMPANY_SITE_COLLECTOR)
            ? scrapeUrl(COMPANY_SITE_COLLECTOR, websiteUrl)
            : Promise.resolve(null),
          crunchbase: usableCollector(CRUNCHBASE_COLLECTOR)
            ? scrapeUrl(CRUNCHBASE_COLLECTOR, `https://www.crunchbase.com/organization/${slug}`)
            : Promise.resolve(null),
          tracxn: Promise.resolve(null),
          linkedin: usableCollector(LINKEDIN_COLLECTOR)
            ? scrapeUrl(LINKEDIN_COLLECTOR, `https://www.linkedin.com/company/${slug}`)
            : Promise.resolve(null),
          tofler: usableCollector(TOFLER_COLLECTOR)
            ? scrapeUrl(TOFLER_COLLECTOR, `https://www.tofler.in/${slug}`)
            : Promise.resolve(null)
        };

        const settled = await Promise.allSettled([
          sourceRequests.website,
          sourceRequests.crunchbase,
          sourceRequests.tracxn,
          sourceRequests.linkedin,
          sourceRequests.tofler
        ]);
        const [website, crunchbase, tracxn, linkedin, tofler] = settled.map((item) =>
          item.status === "fulfilled" ? serializeCollectorResult(item.value) : null
        );

        if (!website && !crunchbase && !linkedin && !tofler) {
          logger.stageWarn(STAGE, `no data for ${competitor.name}, continuing`, {
            domain: competitor.domain
          });
        }

        return {
          competitor,
          sources: {
            website,
            crunchbase,
            tracxn,
            linkedin,
            tofler
          }
        };
      })
    );

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

function serializeCollectorResult(result: unknown): string | null {
  if (!result) {
    return null;
  }
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

function usableCollector(collectorId: string | undefined): collectorId is string {
  return Boolean(collectorId && !collectorId.includes("xxxxxxxx"));
}
