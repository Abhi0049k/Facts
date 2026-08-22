import { failStage, logger } from "@/lib/clients/logger";
import { scrapePage } from "@/lib/clients/brightdata";
import { structuredCall } from "@/lib/clients/llm";
import { tavilySearch } from "@/lib/clients/tavily";
import type { KnownSource } from "@/lib/normalize-domain";
import { type CompanyProfile, type SentimentResult } from "@/lib/types";
import { z } from "zod";

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

export async function analyzeSentiment(
  companies: CompanyProfile[],
  options?: {
    userDomain?: string;
    knownSentimentUrls?: KnownSource[];
    databaseMatch?: boolean;
  }
): Promise<SentimentResult[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "collecting public sentiment sources", { companies: companies.length });

  try {
    const userDomain = options?.userDomain?.replace(/^www\./, "").toLowerCase();
    const knownUrls = options?.knownSentimentUrls ?? [];
    const databaseMatch = Boolean(options?.databaseMatch);

    const sourceBundles = await Promise.all(
      companies.map(async (company) => {
        const isUser =
          Boolean(userDomain) && company.domain.replace(/^www\./, "").toLowerCase() === userDomain;

        if (isUser && databaseMatch && knownUrls.length === 0) {
          return {
            company,
            sources: [] as Array<{ title: string; url: string; content: string }>,
            noVerifiedSources: true
          };
        }

        if (isUser && knownUrls.length) {
          const scraped = await Promise.all(
            knownUrls.map(async (source) => {
              const content = (await scrapePage(source.url).catch(() => null)) ?? "";
              return {
                title: source.sourceType,
                url: source.url,
                content: content.slice(0, 4000)
              };
            })
          );
          return { company, sources: scraped.filter((item) => item.content), noVerifiedSources: false };
        }

        const sources = await tavilySearch(
          `${company.name} reviews Trustpilot Reddit Twitter customer feedback`
        ).catch((error) => {
          logger.stageWarn(STAGE, "Tavily sentiment search failed", {
            company: company.name,
            error: error instanceof Error ? error.message : String(error)
          });
          return [];
        });
        return { company, sources, noVerifiedSources: false };
      })
    );

    const emptyUser = sourceBundles.find((bundle) => bundle.noVerifiedSources);
    const toScore = sourceBundles.filter((bundle) => !bundle.noVerifiedSources);

    const scored =
      toScore.length === 0
        ? []
        : await structuredCall(
            STAGE,
            "You score public sentiment only when supplied sources contain actual review or discussion evidence. If evidence is sparse, omit sentimentScore, set dataAvailable false, and use summary \"insufficient public data\".",
            `Analyze sentiment for each company from these source bundles:
${JSON.stringify(toScore, null, 2)}

Return a SentimentResult JSON array at the top level, in the same company order.
Do not wrap the array in an object.`,
            SentimentResultSchema
          );

    const sentiment: SentimentResult[] = companies.map((company) => {
      if (
        emptyUser &&
        company.domain.replace(/^www\./, "").toLowerCase() === userDomain
      ) {
        return {
          companyName: company.name,
          summary: "No sentiment sources available for this company.",
          sourcesUsed: [],
          dataAvailable: false
        };
      }
      return (
        scored.find((item) => item.companyName.toLowerCase() === company.name.toLowerCase()) ?? {
          companyName: company.name,
          summary: "insufficient public data",
          sourcesUsed: [],
          dataAvailable: false
        }
      );
    });

    logger.stageComplete(STAGE, "sentiment analyzed", {
      durationMs: Date.now() - start,
      companies: sentiment.length,
      withScores: sentiment.filter((item) => item.dataAvailable).length
    });
    return sentiment;
  } catch (error) {
    failStage(STAGE, error, { companies: companies.length });
  }
}
