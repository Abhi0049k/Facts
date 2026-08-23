import { failStage, logger } from "@/lib/clients/logger";
import { jsonCall } from "@/lib/clients/llm";
import { asCompetitorCandidates } from "@/lib/clients/normalize-json";
import { tavilySearch, tavilySearchCompanyMetrics } from "@/lib/clients/tavily";
import { PipelineStageError, type CompanyProfile } from "@/lib/types";

const STAGE = "Stage3-DiscoverCompetitors";

export async function discoverCompetitors(
  profile: CompanyProfile
): Promise<{ name: string; domain?: string }[]> {
  const start = Date.now();
  const servicePhrase = competitorSearchPhrase(profile);
  logger.stageStart(STAGE, "discovering competitor candidates", {
    searchIntentPhrase: servicePhrase,
    exclude: profile.name
  });

  try {
    let candidates: { name: string; domain?: string }[] = [];

    if (process.env.TAVILY_API_KEY?.trim()) {
      candidates = await discoverFromSearch(profile, servicePhrase);
    }

    if (candidates.length < 5) {
      const llmCandidates = await discoverFromLlm(profile, servicePhrase);
      candidates = dedupeByName([...candidates, ...llmCandidates]);
    }

    logger.debug(STAGE, "LLM candidates after normalize", {
      count: candidates.length,
      names: candidates.map((candidate) => candidate.name)
    });

    if (process.env.TAVILY_API_KEY?.trim() && candidates.length < 5) {
      const searched = await discoverFromSearch(profile, servicePhrase, { directFallbackOnly: true });
      candidates = dedupeByName([...candidates, ...searched]);
      logger.debug(STAGE, "merged search candidates", {
        count: candidates.length,
        names: candidates.map((candidate) => candidate.name)
      });
    }

    const canEnrichDomains = Boolean(process.env.TAVILY_API_KEY?.trim());
    const enriched = await Promise.all(
      candidates.map(async (candidate) => {
        if (candidate.domain && isValidCandidateDomain(candidate.domain)) {
          return candidate;
        }
        if (!canEnrichDomains) {
          return { ...candidate, domain: undefined };
        }
        const results = await tavilySearch(`${candidate.name} official website`).catch((error) => {
          logger.stageWarn(STAGE, "Tavily domain enrichment failed", {
            candidate: candidate.name,
            error: error instanceof Error ? error.message : String(error)
          });
          return [];
        });
        const domain = results[0]?.url
          ? new URL(results[0].url).hostname.replace(/^www\./, "")
          : undefined;
        return { ...candidate, domain: domain && isValidCandidateDomain(domain) ? domain : undefined };
      })
    );

    const deduped = dedupeByName(enriched).filter(
      (candidate) => !isTargetCompany(candidate, profile)
    );

    if (deduped.length === 0) {
      throw new PipelineStageError(
        STAGE,
        "No competitor candidates could be parsed from the model or search. Try again or set TAVILY_API_KEY."
      );
    }

    logger.stageComplete(STAGE, "competitor candidates ready for ranking", {
      durationMs: Date.now() - start,
      candidates: deduped.length,
      withDomains: deduped.filter((candidate) => candidate.domain).length,
      names: deduped.map((candidate) => candidate.name)
    });
    return deduped;
  } catch (error) {
    failStage(STAGE, error, { searchIntentPhrase: servicePhrase });
  }
}

async function discoverFromLlm(
  profile: CompanyProfile,
  servicePhrase: string
): Promise<{ name: string; domain?: string }[]> {
  try {
    const raw = await jsonCall(
      STAGE,
      "You identify real competitor companies from the target company's extracted profile. Do not use generic examples. Competitors must provide substantially similar products or services to the target.",
      `Target company:
${JSON.stringify(profile, null, 2)}

Target service phrase: ${servicePhrase}

List 8 companies that provide the same or very similar services.
Exclude ${profile.name} and ${profile.domain}.
Avoid broad same-industry companies if they do not sell the same core offering.
Return JSON only. Prefer a top-level array:
[{"name":"company name","domain":"official-domain.com"}]
If you return an object, put the list on "competitors". Domain must be a hostname, never a category label.`
    );
    return asCompetitorCandidates(raw);
  } catch (error) {
    logger.stageWarn(STAGE, "LLM discovery failed, continuing with search", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

async function discoverFromSearch(
  profile: CompanyProfile,
  servicePhrase: string,
  options?: { directFallbackOnly?: boolean }
): Promise<{ name: string; domain?: string }[]> {
  const query = `${servicePhrase} competitors alternatives to ${profile.name}`;
  const results = await tavilySearch(query).catch((error) => {
    logger.stageWarn(STAGE, "Tavily competitor search failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  });

  if (!results.length) {
    return [];
  }

  if (!options?.directFallbackOnly) {
    const extracted = await extractCompetitorsFromSearch(profile, servicePhrase, results);
    if (extracted.length) {
      return extracted;
    }
  }

  return directCandidatesFromSearchResults(results, profile);
}

async function extractCompetitorsFromSearch(
  profile: CompanyProfile,
  servicePhrase: string,
  results: Awaited<ReturnType<typeof tavilySearch>>
): Promise<{ name: string; domain?: string }[]> {
  try {
    const raw = await jsonCall(
      STAGE,
      "You extract actual competitor companies from web search results. Use the result snippets as evidence and ignore listicle, media, directory, and search-result page publishers unless that publisher is itself a direct competitor.",
      `Target company:
${JSON.stringify(profile, null, 2)}

Target service phrase: ${servicePhrase}

Tavily results:
${JSON.stringify(results.slice(0, 8), null, 2)}

Return up to 8 direct competitors with official domains:
[{"name":"company name","domain":"official-domain.com"}]

Rules:
- Exclude ${profile.name} and ${profile.domain}.
- Pick companies providing the same core service, not generic same-category companies.
- Domain must be the competitor's official website hostname.`
    );
    return asCompetitorCandidates(raw);
  } catch (error) {
    logger.stageWarn(STAGE, "search result extraction failed, using direct result domains", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

function directCandidatesFromSearchResults(
  results: Awaited<ReturnType<typeof tavilySearch>>,
  profile: CompanyProfile
): { name: string; domain: string }[] {
  return results
    .map((result) => {
      try {
        const domain = new URL(result.url).hostname.replace(/^www\./, "");
        if (isSearchOrPublisherDomain(domain) || domain === profile.domain) {
          return null;
        }
        const name = result.title.replace(/\s*[|\-–:].*$/, "").trim() || domain;
        return { name, domain };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is { name: string; domain: string } => Boolean(candidate));
}

function competitorSearchPhrase(profile: CompanyProfile): string {
  const phrase = profile.searchIntentPhrase?.trim();
  if (phrase && !new RegExp(`\\b${escapeRegExp(profile.name)}\\b`, "i").test(phrase)) {
    return phrase;
  }

  const summary = profile.offeringsSummary
    .replace(new RegExp(`\\b${escapeRegExp(profile.name)}\\b`, "gi"), "")
    .replace(/\s+/g, " ")
    .trim();
  const clipped = summary.length > 180 ? summary.slice(0, 180) : summary;
  return clipped || `${profile.category} companies`;
}

function isSearchOrPublisherDomain(domain: string): boolean {
  return /(^|\.)google\./i.test(domain) ||
    /(^|\.)bing\./i.test(domain) ||
    /(^|\.)linkedin\.com$/i.test(domain) ||
    /(^|\.)wikipedia\.org$/i.test(domain) ||
    /(^|\.)crunchbase\.com$/i.test(domain) ||
    /(^|\.)tracxn\.com$/i.test(domain) ||
    /(^|\.)g2\.com$/i.test(domain) ||
    /(^|\.)capterra\.com$/i.test(domain) ||
    /(^|\.)alternativeto\.net$/i.test(domain);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidCandidateDomain(domain: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && !domain.includes("..");
}

function dedupeByName(candidates: { name: string; domain?: string }[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = (candidate.domain || candidate.name).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isTargetCompany(candidate: { name: string; domain?: string }, profile: CompanyProfile): boolean {
  const candName = candidate.name.toLowerCase().trim();
  const targetName = profile.name.toLowerCase().trim();
  
  if (candName === targetName || candName.includes(targetName) || targetName.includes(candName)) {
    return true;
  }
  
  if (candidate.domain && profile.domain) {
    const candHost = candidate.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].replace(/^www\./, "");
    const targetHost = profile.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].replace(/^www\./, "");
    
    if (candHost === targetHost || candHost.includes(targetHost) || targetHost.includes(candHost)) {
      return true;
    }
  }
  
  return false;
}
