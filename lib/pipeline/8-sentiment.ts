import { z } from "zod";
import { logger } from "@/lib/clients/logger";
import { structuredCall } from "@/lib/clients/llm";
import { tavilySearch } from "@/lib/clients/tavily";
import { PipelineStageError, type CompanyProfile, type SentimentResult } from "@/lib/types";

const STAGE = "Stage8-Sentiment";

const SentimentResultSchema = z.array(
  z.object({
    companyName: z.string(),
    sentimentScore: z.number().min(0).max(100).optional(),
    summary: z.string(),
    sourcesUsed: z.array(z.string()),
    dataAvailable: z.boolean()
  })
);

export async function analyzeSentiment(companies: CompanyProfile[]): Promise<SentimentResult[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "collecting public sentiment sources", { companies: companies.length });

  try {
    const sourceBundles = await Promise.all(
      companies.map(async (company) => {
        const sources = await tavilySearch(
          `${company.name} reviews Trustpilot Reddit Twitter customer feedback`
        ).catch((error) => {
          logger.stageWarn(STAGE, "Tavily sentiment search failed", {
            company: company.name,
            error: error instanceof Error ? error.message : String(error)
          });
          return [];
        });
        return { company, sources };
      })
    );

    const sentiment = await structuredCall(
      STAGE,
      "You score public sentiment only when supplied sources contain actual review or discussion evidence. If evidence is sparse, omit sentimentScore, set dataAvailable false, and use summary \"insufficient public data\".",
      `Analyze sentiment for each company from these source bundles:
${JSON.stringify(sourceBundles, null, 2)}

Return a SentimentResult array in the same company order.`,
      SentimentResultSchema
    );

    logger.stageComplete(STAGE, "sentiment analyzed", {
      durationMs: Date.now() - start,
      companies: sentiment.length
    });
    return sentiment;
  } catch (error) {
    throw new PipelineStageError(STAGE, error instanceof Error ? error.message : String(error));
  }
}
