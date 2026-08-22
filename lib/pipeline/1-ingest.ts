import { canScrapeCompanyPages, scrapePage } from "@/lib/clients/brightdata";
import { failStage, logger } from "@/lib/clients/logger";
import { PipelineStageError } from "@/lib/types";

const STAGE = "Stage1-Ingest";

export async function ingestUserCompany(companyUrl: string): Promise<string> {
  const start = Date.now();
  logger.stageStart(STAGE, "scraping company homepage to markdown/JSON", { url: companyUrl });

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
        `Failed to scrape ${companyUrl}. Check the Bright Data API token and Web Unlocker zone.`
      );
    }

    logger.stageComplete(STAGE, "homepage scrape ready for Stage 2", {
      durationMs: Date.now() - start,
      chars: rawContent.length,
      preview: rawContent.slice(0, 180)
    });
    return rawContent;
  } catch (error) {
    failStage(STAGE, error, { url: companyUrl });
  }
}
