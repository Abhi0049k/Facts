import { canScrapeCompanyPages, scrapePage } from "@/lib/clients/brightdata";
import { failStage, logger } from "@/lib/clients/logger";
import type { KnownSource } from "@/lib/normalize-domain";
import { PipelineStageError } from "@/lib/types";

const STAGE = "Stage1-Ingest";

export async function ingestUserCompany(
  companyUrl: string,
  sources: KnownSource[] = []
): Promise<string> {
  const start = Date.now();
  const targets = sources.length ? uniqueUrls(sources.map((source) => source.url)) : [companyUrl];
  logger.stageStart(STAGE, "scraping company pages to markdown/JSON", {
    url: companyUrl,
    targets: targets.length,
    fromDatabase: sources.length > 0,
    sourceTypes: sources.map((source) => `${source.sourceCategory}:${source.sourceType}`)
  });

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

    const parts: string[] = [];
    for (const target of targets) {
      const rawContent = await scrapePage(target);
      if (rawContent) {
        parts.push(`# Source: ${target}\n\n${rawContent}`);
      } else {
        logger.stageWarn(STAGE, "scrape returned empty", { target });
      }
    }

    if (!parts.length) {
      throw new PipelineStageError(STAGE, `No data could be found for this company (${companyUrl}).`);
    }

    const combined = parts.join("\n\n");
    logger.stageComplete(STAGE, "page scrape ready for Stage 2", {
      durationMs: Date.now() - start,
      chars: combined.length,
      sources: parts.length,
      preview: combined.slice(0, 180)
    });
    return combined;
  } catch (error) {
    failStage(STAGE, error, { url: companyUrl });
  }
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls.filter(Boolean))];
}
