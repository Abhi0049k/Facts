import type { SiteKind } from "@/lib/types";

export type { SiteKind };

export function siteKindHint(companyUrl: string): { hint: SiteKind | "unknown"; note: string } {
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(companyUrl) ? companyUrl : `https://${companyUrl}`);
  } catch {
    return { hint: "unknown", note: "URL could not be parsed." };
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    if (segments[0] === "in" || segments[0] === "pub" || segments[0] === "mwlite") {
      return {
        hint: "personal_profile",
        note: "This URL is a LinkedIn person profile, not a company page."
      };
    }
    if (segments[0] === "company" || segments[0] === "school") {
      return { hint: "company", note: "This URL is a LinkedIn organization page." };
    }
  }

  if (host === "x.com" || host === "twitter.com" || host === "instagram.com" || host === "tiktok.com") {
    return {
      hint: "personal_profile",
      note: "This looks like a social profile, not a company homepage."
    };
  }

  if (
    host === "linktr.ee" ||
    host === "about.me" ||
    host.endsWith(".carrd.co") ||
    host === "bio.site"
  ) {
    return { hint: "personal_profile", note: "This looks like a personal link page." };
  }

  if (host.endsWith("wikipedia.org") || host === "youtube.com" || host === "youtu.be") {
    return { hint: "not_a_company", note: "This host is not a company homepage." };
  }

  if (host === "github.com" && segments.length === 1) {
    return {
      hint: "unknown",
      note: "GitHub user or org pages need page content to tell personal from company."
    };
  }

  return { hint: "unknown", note: "No URL heuristic. Classify from scraped page text." };
}

export function haltMessage(siteKind: SiteKind, reason: string): string {
  if (siteKind === "personal_profile") {
    return `This looks like a personal profile, not a company. ${reason} Facts only ranks competitors for businesses, so there is no competitor set to build from this URL.`;
  }
  return `This page does not look like a company. ${reason} Paste a business homepage (for example the public site of a product or service company).`;
}
