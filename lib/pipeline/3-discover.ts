import { failStage, logger } from "@/lib/clients/logger";
import { jsonCall } from "@/lib/clients/llm";
import { asCompetitorCandidates } from "@/lib/clients/normalize-json";
import { tavilySearch } from "@/lib/clients/tavily";
import { PipelineStageError, type CompanyProfile } from "@/lib/types";

const STAGE = "Stage3-DiscoverCompetitors";

export async function discoverCompetitors(
  profile: CompanyProfile
): Promise<{ name: string; domain?: string }[]> {
  const start = Date.now();
  logger.stageStart(STAGE, "discovering competitor candidates", {
    searchIntentPhrase: profile.searchIntentPhrase,
    exclude: profile.name
  });

  try {
    let candidates = await discoverFromLlm(profile);
    logger.debug(STAGE, "LLM candidates after normalize", {
      count: candidates.length,
      names: candidates.map((candidate) => candidate.name)
    });

    if (candidates.length === 0 || (process.env.TAVILY_API_KEY && candidates.length < 5)) {
      const searched = await discoverFromSearch(profile);
      candidates = dedupeByName([...candidates, ...searched]);
      logger.debug(STAGE, "merged search candidates", {
        count: candidates.length,
        names: candidates.map((candidate) => candidate.name)
      });
    }

    const enriched = await Promise.all(
      candidates.map(async (candidate) => {
        if (candidate.domain) {
          return candidate;
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
        return { ...candidate, domain };
      })
    );

    const deduped = dedupeByName(enriched).filter(
      (candidate) => candidate.name.toLowerCase() !== profile.name.toLowerCase()
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
    failStage(STAGE, error, { searchIntentPhrase: profile.searchIntentPhrase });
  }
}

async function discoverFromLlm(profile: CompanyProfile): Promise<{ name: string; domain?: string }[]> {
  try {
    const raw = await jsonCall(
      STAGE,
      "You identify likely competitors from model knowledge only.",
      `List 8 companies that compete with: "${profile.searchIntentPhrase}".
Exclude ${profile.name}.
Return JSON only. Prefer a top-level array:
[{"name":"Pluralsight","domain":"pluralsight.com"},{"name":"Udemy","domain":"udemy.com"}]
If you return an object, put the list on "competitors". Domain must be a hostname like udemy.com, never a category label.`
    );
    return asCompetitorCandidates(raw);
  } catch (error) {
    logger.stageWarn(STAGE, "LLM discovery failed, continuing with search", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

async function discoverFromSearch(profile: CompanyProfile): Promise<{ name: string; domain?: string }[]> {
  const query = `${profile.searchIntentPhrase} competitors alternatives to ${profile.name}`;
  const results = await tavilySearch(query).catch((error) => {
    logger.stageWarn(STAGE, "Tavily competitor search failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  });

  return results
    .map((result) => {
      try {
        const domain = new URL(result.url).hostname.replace(/^www\./, "");
        const name = result.title.replace(/\s*[|\-–:].*$/, "").trim() || domain;
        return { name, domain };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is { name: string; domain: string } => Boolean(candidate));
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
