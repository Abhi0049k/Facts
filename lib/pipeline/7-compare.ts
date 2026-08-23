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
  const metricsTable = buildMetricsTable(userCompany, competitors);

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
    markdown,
    metricsTable
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
    `- **Domain:** ${company.domain || "N/A"}`,
    `- **Category:** ${company.category || "N/A"}`,
    `- **Offerings:** ${company.offeringsSummary || "N/A"}`
  ];

  if (company.founders?.length) {
    lines.push(`- **Founders:** ${company.founders.join(", ")}`);
  }
  lines.push(`- **Founded Year:** ${stats.foundedYear ? stats.foundedYear : "N/A"}`);
  lines.push(`- **Funding Raised:** ${stats.fundingTotal?.trim() ? stats.fundingTotal : "N/A"}`);
  lines.push(`- **Employees Count:** ${stats.employeeCount?.trim() ? stats.employeeCount : "N/A"}`);
  lines.push(`- **Revenue Estimate:** ${stats.revenueEstimate?.trim() ? stats.revenueEstimate : "N/A"}`);
  if (company.searchIntentPhrase) {
    lines.push(`- **Search phrase:** ${company.searchIntentPhrase}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildMetricsTable(userCompany: CompanyProfile, competitors: CompanyProfile[]): string {
  const allCompanies = [userCompany, ...competitors];
  const headers = ["Metric", "Your Company", ...competitors.map((c) => c.name)];

  const rows = [
    ["Founded Year", formatValue(userCompany.stats.foundedYear), ...competitors.map((c) => formatValue(c.stats.foundedYear))],
    ["Employees", formatValue(userCompany.stats.employeeCount), ...competitors.map((c) => formatValue(c.stats.employeeCount))],
    ["Funding Raised", formatValue(userCompany.stats.fundingTotal), ...competitors.map((c) => formatValue(c.stats.fundingTotal))],
    ["Revenue Estimate", formatValue(userCompany.stats.revenueEstimate), ...competitors.map((c) => formatValue(c.stats.revenueEstimate))],
    ["Founders", formatValue(userCompany.founders?.join(", ")), ...competitors.map((c) => formatValue(c.founders?.join(", ")))],
    ["Category", formatValue(userCompany.category), ...competitors.map((c) => formatValue(c.category))],
  ];

  const colWidths = headers.map((_, colIdx) =>
    Math.max(headers[colIdx].length, ...rows.map((row) => row[colIdx].length))
  );

  const sep = "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerRow = "| " + headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ") + " |";
  const dataRows = rows.map((row) => "| " + row.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |");

  return [sep, headerRow, sep, ...dataRows, sep].join("\n");
}

function formatValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }
  return String(value);
}