import { logger } from "@/lib/clients/logger";
import { type CompanyProfile, type ComparisonResult } from "@/lib/types";

const STAGE = "Stage7-Compare";

export async function compareCompanies(
  userCompany: CompanyProfile,
  competitors: CompanyProfile[]
): Promise<ComparisonResult> {
  const start = Date.now();
  logger.stageStart(STAGE, "writing company briefing markdown", { competitors: competitors.length });

  const markdown = formatCompaniesMarkdown(userCompany, competitors);

  logger.stageComplete(STAGE, "company briefing ready", {
    durationMs: Date.now() - start,
    competitorCount: competitors.length,
    chars: markdown.length
  });

  return {
    userCompany,
    competitors,
    serviceOverlap: [],
    gaps: [],
    markdown
  };
}

function formatCompaniesMarkdown(userCompany: CompanyProfile, competitors: CompanyProfile[]): string {
  const sections = [
    "# Company briefing",
    "",
    "Profiles below come from earlier extract steps. Overlap and gap scoring is skipped.",
    "",
    formatOneCompany(userCompany, "Your company"),
    ...competitors.map((company, index) => formatOneCompany(company, `Competitor ${index + 1}`))
  ];
  return sections.join("\n").trim() + "\n";
}

function formatOneCompany(company: CompanyProfile, heading: string): string {
  const stats = company.stats;
  const lines = [
    `## ${heading}: ${company.name}`,
    "",
    `- **Domain:** ${company.domain}`,
    `- **Category:** ${company.category || "unknown"}`,
    `- **Offerings:** ${company.offeringsSummary || "not listed"}`
  ];

  if (company.founders?.length) {
    lines.push(`- **Founders:** ${company.founders.join(", ")}`);
  }
  if (stats.foundedYear) {
    lines.push(`- **Founded:** ${stats.foundedYear}`);
  }
  lines.push(`- **Funding:** ${stats.fundingTotal || "not listed"}`);
  lines.push(`- **Employees:** ${stats.employeeCount || "not listed"}`);
  lines.push(`- **Revenue:** ${stats.revenueEstimate || "not listed"}`);
  if (company.searchIntentPhrase) {
    lines.push(`- **Search phrase:** ${company.searchIntentPhrase}`);
  }
  lines.push("");
  return lines.join("\n");
}
