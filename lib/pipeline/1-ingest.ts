import { scrapeUrl } from "@/lib/clients/brightdata";
import { logger } from "@/lib/clients/logger";
import { PipelineStageError } from "@/lib/types";

const COMPANY_SITE_COLLECTOR = process.env.BRIGHT_DATA_COLLECTOR_COMPANY_SITE;
const STAGE = "Stage1-Ingest";

export async function ingestUserCompany(companyUrl: string): Promise<string> {
  const start = Date.now();
  logger.stageStart(STAGE, "scraping company site", { url: companyUrl });

  try {
    if (!COMPANY_SITE_COLLECTOR) {
      throw new PipelineStageError(
        STAGE,
        "BRIGHT_DATA_COLLECTOR_COMPANY_SITE is not set - create the Bright Data company-site collector and add its c_... ID to .env.local"
      );
    }
    if (COMPANY_SITE_COLLECTOR.includes("xxxxxxxx")) {
      throw new PipelineStageError(
        STAGE,
        "BRIGHT_DATA_COLLECTOR_COMPANY_SITE is still a placeholder - replace it with the c_... Collector ID from Bright Data Scraper Studio"
      );
    }

    const result = await scrapeUrl(COMPANY_SITE_COLLECTOR, companyUrl);
    if (!result) {
      throw new PipelineStageError(
        STAGE,
        `Failed to scrape ${companyUrl} - check Bright Data collector and API token`
      );
    }

    logger.stageComplete(STAGE, "scraping company site", { durationMs: Date.now() - start });
    return serializeCollectorResult(result);
  } catch (error) {
    if (error instanceof PipelineStageError) {
      throw error;
    }
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}

function serializeCollectorResult(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}
