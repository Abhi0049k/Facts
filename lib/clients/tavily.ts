import { logger } from "@/lib/clients/logger";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  const stage = "Tavily";

  if (!apiKey) {
    logger.stageWarn(stage, "TAVILY_API_KEY missing, using mock search results", { query });
    return mockTavily(query);
  }

  logger.debug(stage, "search starting", { query });
  const started = Date.now();

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 5
      }),
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Tavily HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }

    const data = (await response.json()) as { results?: TavilyResult[] };
    const results = data.results ?? [];
    logger.debug(stage, "search complete", {
      query,
      durationMs: Date.now() - started,
      results: results.length,
      urls: results.map((result) => result.url)
    });
    return results;
  } catch (error) {
    logger.exception(stage, error, { query, durationMs: Date.now() - started });
    throw error;
  }
}

export async function tavilySearchCompanyMetrics(
  companyName: string,
  domain?: string
): Promise<TavilyResult[]> {
  const query = `${companyName} ${domain ? domain : ""} founded year funding raised employees revenue`;
  return tavilySearch(query);
}

function mockTavily(query: string): TavilyResult[] {
  const candidates = [
    ["AlphaSense", "https://www.alpha-sense.com"],
    ["Crayon", "https://www.crayon.co"],
    ["Klue", "https://www.klue.com"],
    ["Kompyte", "https://www.kompyte.com"],
    ["Contify", "https://www.contify.com"]
  ];

  return candidates.map(([title, url]) => ({
    title,
    url,
    content: `${title} appears relevant for ${query} and provides competitive intelligence or market research software.`
  }));
}
