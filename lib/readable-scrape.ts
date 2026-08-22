/** Strip scrape noise so people can read a page, not a data URI dump. */
export function readableScrape(text: string, maxChars = 1800): string {
  const cleaned = text
    .replace(/!\[[^\]]*]\(data:image\/[^)]+\)/gi, "")
    .replace(/data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+/gi, "")
    .replace(/\[Skip to [^\]]+]\([^)]+\)/gi, "")
    .replace(/\[!]\([^)]*\)/g, "")
    .replace(/https?:\/\/\S{80,}/g, "[long url]")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= maxChars) {
    return cleaned || "No readable text in this scrape.";
  }
  return `${cleaned.slice(0, maxChars).trim()}…`;
}

export function compactSourceText(text: string | null, maxChars: number): string | null {
  if (!text) {
    return null;
  }
  return readableScrape(text, maxChars);
}
