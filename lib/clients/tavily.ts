export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return mockTavily(query);
  }

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
    throw new Error(`Tavily ${response.status}`);
  }

  const data = (await response.json()) as { results?: TavilyResult[] };
  return data.results ?? [];
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
