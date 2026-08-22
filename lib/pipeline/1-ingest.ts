import { canScrapeCompanyPages, scrapePage } from "@/lib/clients/brightdata";
import { logger } from "@/lib/clients/logger";
import { PipelineStageError } from "@/lib/types";

const STAGE = "Stage1-Ingest";

export async function ingestUserCompany(companyUrl: string): Promise<string> {
  const start = Date.now();
  logger.stageStart(STAGE, "scraping company site", { url: companyUrl });

  try {
    if (!process.env.BRIGHT_DATA_API_TOKEN?.trim()) {
      throw new PipelineStageError(STAGE, "BRIGHT_DATA_API_TOKEN is not set");
    }
    if (!(await canScrapeCompanyPages())) {
      throw new PipelineStageError(
        STAGE,
        "Set BRIGHT_DATA_WEB_UNLOCKER_ZONE (Web Unlocker zone name) or BRIGHT_DATA_COLLECTOR_COMPANY_SITE (gd_… dataset or c_… collector) in .env.local"
      );
    }

    const rawContent = await scrapePage(companyUrl);
    if (!rawContent) {
      throw new PipelineStageError(
        STAGE,
        `Failed to scrape ${companyUrl} — check the Bright Data API token and Web Unlocker zone`
      );
    }

    logger.stageComplete(STAGE, "scraping company site", { durationMs: Date.now() - start });
    return rawContent;
  } catch (error) {
    if (error instanceof PipelineStageError) {
      throw error;
    }
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}
