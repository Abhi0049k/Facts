"use client";

import { useState, type ReactNode } from "react";
import { Building2, Calendar, CircleDollarSign, ExternalLink, Users } from "lucide-react";

interface ParsedCompany {
  heading: string;
  name: string;
  domain?: string;
  category?: string;
  offerings?: string;
  founders?: string;
  foundedYear?: string;
  fundingRaised?: string;
  employeesCount?: string;
  revenueEstimate?: string;
  searchPhrase?: string;
  rawList: string[];
}

export function MarkdownReport({ markdown }: { markdown: string }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"tabs" | "grid">("tabs");

  const parsedCompanies = parseCompanyMarkdown(markdown);

  if (!markdown || !markdown.trim()) {
    return <p className="p-6 text-sm text-neutral-500">No company briefing available.</p>;
  }

  // If structured company sections were parsed from markdown
  if (parsedCompanies.length > 0) {
    const selectedCompany = parsedCompanies[activeTabIndex] ?? parsedCompanies[0];

    return (
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h3 className="font-semibold text-ink">Company Intelligence Briefing</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Detailed market profiles for target company and top discovered competitors ({parsedCompanies.length} total).
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-paper p-1 text-xs font-semibold">
            <button
              className={`rounded-md px-3 py-1.5 transition ${
                viewMode === "tabs"
                  ? "bg-accent text-white shadow-sm"
                  : "text-neutral-600 hover:text-ink"
              }`}
              onClick={() => setViewMode("tabs")}
              type="button"
            >
              Tabbed View
            </button>
            <button
              className={`rounded-md px-3 py-1.5 transition ${
                viewMode === "grid"
                  ? "bg-accent text-white shadow-sm"
                  : "text-neutral-600 hover:text-ink"
              }`}
              onClick={() => setViewMode("grid")}
              type="button"
            >
              Grid View ({parsedCompanies.length})
            </button>
          </div>
        </div>

        {viewMode === "tabs" ? (
          <div className="px-6 pb-6">
            {/* Tabs Bar */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {parsedCompanies.map((comp, idx) => {
                const isActive = idx === activeTabIndex;
                const isTarget = idx === 0;
                return (
                  <button
                    key={comp.name + idx}
                    onClick={() => setActiveTabIndex(idx)}
                    type="button"
                    className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-accent bg-accent text-white shadow-sm"
                        : "border-line bg-paper text-neutral-700 hover:border-accent/40 hover:bg-panel"
                    }`}
                  >
                    {isTarget ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                          isActive ? "bg-white/20 text-white" : "bg-accent/10 text-accent"
                        }`}
                      >
                        Target
                      </span>
                    ) : null}
                    <span>{comp.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Tab Card View */}
            <CompanyBriefingCard company={selectedCompany} isTarget={activeTabIndex === 0} />
          </div>
        ) : (
          /* Grid View for All Companies */
          <div className="grid gap-5 px-6 pb-6 md:grid-cols-2 xl:grid-cols-3">
            {parsedCompanies.map((comp, idx) => (
              <CompanyBriefingCard company={comp} isTarget={idx === 0} key={comp.name + idx} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback: render raw blocks if not parsed into company sections
  const blocks = parseGenericMarkdown(markdown);
  return (
    <div className="space-y-4 px-6 py-5 text-sm leading-7 text-neutral-700">
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return (
            <h1 className="text-xl font-semibold tracking-tight text-ink" key={index}>
              {renderInline(block.text)}
            </h1>
          );
        }
        if (block.type === "h2") {
          return (
            <h2 className="pt-2 text-lg font-semibold text-ink" key={index}>
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 className="pt-1 text-base font-semibold text-ink" key={index}>
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul className="space-y-2 pl-5" key={index}>
              {block.items.map((item, itemIndex) => (
                <li className="list-disc marker:text-accent" key={itemIndex}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p className="max-w-none text-neutral-700" key={index}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function CompanyBriefingCard({ company, isTarget }: { company: ParsedCompany; isTarget: boolean }) {
  return (
    <div
      className={`rounded-2xl border bg-panel p-6 shadow-panel transition ${
        isTarget ? "border-2 border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isTarget ? (
              <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                Target Company
              </span>
            ) : (
              <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Competitor
              </span>
            )}
            {company.category && company.category !== "N/A" ? (
              <span className="text-xs text-neutral-500">• {company.category}</span>
            ) : null}
          </div>
          <h4 className="mt-1 text-xl font-semibold text-ink">{company.name}</h4>
          {company.domain && company.domain !== "N/A" ? (
            <a
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              href={company.domain.startsWith("http") ? company.domain : `https://${company.domain}`}
              rel="noreferrer"
              target="_blank"
            >
              {company.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      {company.offerings && company.offerings !== "N/A" ? (
        <div className="mt-4 text-sm leading-6 text-neutral-700">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Offerings</div>
          <p className="mt-1">{company.offerings}</p>
        </div>
      ) : null}

      {company.founders && company.founders !== "N/A" ? (
        <div className="mt-3 text-xs text-neutral-600">
          <span className="font-semibold text-neutral-500">Founders: </span>
          <span className="text-ink">{company.founders}</span>
        </div>
      ) : null}

      {/* 4 Stats Grid */}
      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <StatBadge icon={<Calendar />} label="Founded Year" value={company.foundedYear} />
        <StatBadge icon={<CircleDollarSign />} label="Funding Raised" value={company.fundingRaised} />
        <StatBadge icon={<Users />} label="Employees Count" value={company.employeesCount} />
        <StatBadge icon={<Building2 />} label="Revenue Estimate" value={company.revenueEstimate} />
      </dl>

      {company.searchPhrase ? (
        <div className="mt-4 border-t border-line/60 pt-3 text-[11px] text-neutral-400">
          Search intent: <span className="font-medium text-neutral-600">{company.searchPhrase}</span>
        </div>
      ) : null}
    </div>
  );
}

function StatBadge({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  const isAvailable = value && value.trim() && value.toLowerCase() !== "not listed" && value.trim() !== "N/A";
  const display = isAvailable ? value.trim() : "N/A";
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
        <span className="text-accent [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <dd className={`mt-1 text-xs font-semibold ${isAvailable ? "text-ink" : "text-neutral-400"}`}>{display}</dd>
    </div>
  );
}

function parseCompanyMarkdown(markdown: string): ParsedCompany[] {
  const companies: ParsedCompany[] = [];
  const sections = markdown.split(/^##\s+/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const titleLine = lines[0];
    const matchName = titleLine.match(/^(?:Your company|Competitor\s*\d*):\s*(.+)$/i) || titleLine.match(/^(.+)$/);
    if (!matchName) continue;

    if (!titleLine.toLowerCase().includes("company") && !titleLine.toLowerCase().includes("competitor")) {
      continue;
    }

    const company: ParsedCompany = {
      heading: titleLine,
      name: matchName[1].trim(),
      rawList: []
    };

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      const bulletMatch = line.match(/^[-*]\s*\*\*([^*]+):\*\*\s*(.+)$/);
      if (bulletMatch) {
        const key = bulletMatch[1].toLowerCase().trim();
        const val = bulletMatch[2].trim();
        if (key.includes("domain")) company.domain = val;
        else if (key.includes("category")) company.category = val;
        else if (key.includes("offering")) company.offerings = val;
        else if (key.includes("founder")) company.founders = val;
        else if (key.includes("founded")) company.foundedYear = val;
        else if (key.includes("funding")) company.fundingRaised = val;
        else if (key.includes("employee")) company.employeesCount = val;
        else if (key.includes("revenue")) company.revenueEstimate = val;
        else if (key.includes("search phrase")) company.searchPhrase = val;
        else company.rawList.push(line);
      } else if (line.startsWith("- ")) {
        company.rawList.push(line);
      }
    }

    companies.push(company);
  }

  return companies;
}

type GenericBlock =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

function parseGenericMarkdown(markdown: string): GenericBlock[] {
  const blocks: GenericBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: heading[1].length === 1 ? "h1" : heading[1].length === 2 ? "h2" : "h3",
        text: heading[2].trim()
      });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const markdownLinkUrl = match[2];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong className="font-semibold text-ink" key={nodes.length}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (markdownLinkUrl) {
      const label = token.slice(1, token.indexOf("]("));
      nodes.push(linkNode(label, markdownLinkUrl, nodes.length));
    } else {
      nodes.push(linkNode(token, token, nodes.length));
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function linkNode(label: string, href: string, key: number) {
  return (
    <a
      className="font-medium text-accent underline-offset-2 hover:underline"
      href={href}
      key={key}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}
