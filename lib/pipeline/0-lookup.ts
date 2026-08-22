import { logger } from "@/lib/clients/logger";
import { prisma } from "@/lib/clients/prisma";
import { normalizeDomain, type KnownSource } from "@/lib/normalize-domain";

const STAGE = "Stage0-Lookup";

export type CompanyLookupResult =
  | {
      found: true;
      companyName: string;
      domain: string;
      infoUrls: KnownSource[];
      sentimentUrls: KnownSource[];
    }
  | { found: false; domain: string };

export async function lookupCompany(userInputUrl: string): Promise<CompanyLookupResult> {
  const normalizedDomain = normalizeDomain(userInputUrl);
  logger.stageStart(STAGE, "checking database for known company", { domain: normalizedDomain });

  if (!normalizedDomain) {
    logger.stageWarn(STAGE, "company not found in database", { domain: normalizedDomain });
    return { found: false, domain: "" };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    logger.stageWarn(STAGE, "DATABASE_URL is not set; skipping lookup", { domain: normalizedDomain });
    return { found: false, domain: normalizedDomain };
  }

  try {
    const existing = await prisma.company.findUnique({
      where: { primaryDomain: normalizedDomain },
      include: { sources: true }
    });

    if (existing) {
      const infoUrls = existing.sources
        .filter((source) => source.sourceCategory === "info")
        .map(toKnownSource);
      const sentimentUrls = existing.sources
        .filter((source) => source.sourceCategory === "sentiment")
        .map(toKnownSource);

      logger.stageComplete(STAGE, "found in database", {
        companyName: existing.companyName,
        sourceCount: existing.sources.length
      });

      return {
        found: true,
        companyName: existing.companyName,
        domain: existing.primaryDomain,
        infoUrls,
        sentimentUrls
      };
    }

    logger.stageWarn(STAGE, "company not found in database", { domain: normalizedDomain });
    return { found: false, domain: normalizedDomain };
  } catch (error) {
    logger.stageWarn(STAGE, "lookup failed; continuing with live discovery", {
      domain: normalizedDomain,
      error: error instanceof Error ? error.message : String(error)
    });
    return { found: false, domain: normalizedDomain };
  }
}

function toKnownSource(source: {
  url: string;
  sourceType: string;
  sourceCategory: string;
  notes: string | null;
}): KnownSource {
  return {
    url: source.url,
    sourceType: source.sourceType,
    sourceCategory: source.sourceCategory === "sentiment" ? "sentiment" : "info",
    notes: source.notes
  };
}
