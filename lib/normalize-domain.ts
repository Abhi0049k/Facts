export function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .replace(/\/$/, "");
  }
}

export type KnownSource = {
  url: string;
  sourceType: string;
  sourceCategory: "info" | "sentiment";
  notes?: string | null;
};
