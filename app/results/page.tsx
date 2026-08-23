"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CompanyProfile, PipelineState, SentimentResult } from "@/lib/types";

type StoredReport = {
  generatedAt: string;
  domain: string;
  includeSentiment: boolean;
  state: PipelineState;
};

const FALLBACK_GENERATED = "Aug 23, 2026";

function formatDate(value?: string) {
  if (!value) return FALLBACK_GENERATED;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function loadStoredReport(domain: string, includeSentiment: boolean): StoredReport | null {
  const keyed = localStorage.getItem(`facts:report:${domain}:${includeSentiment ? "1" : "0"}`);
  const latest = sessionStorage.getItem("facts:lastReport");
  const raw = keyed || latest;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredReport;
    return parsed.domain === domain ? parsed : null;
  } catch {
    return null;
  }
}

function formatStatValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "N/A";
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "not listed" || str.toLowerCase() === "unavailable") return "N/A";
  return str;
}

function isSameCompany(comp: CompanyProfile, target: CompanyProfile): boolean {
  const candName = comp.name.toLowerCase().trim();
  const targetName = target.name.toLowerCase().trim();
  if (candName === targetName || candName.includes(targetName) || targetName.includes(candName)) {
    return true;
  }
  if (comp.domain && target.domain) {
    const candHost = comp.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].replace(/^www\./, "");
    const targetHost = target.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].replace(/^www\./, "");
    if (candHost === targetHost || candHost.includes(targetHost) || targetHost.includes(candHost)) {
      return true;
    }
  }
  return false;
}

function ReportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const domain = searchParams.get("url") || "";
  const includeSentiment = searchParams.get("sentiment") === "1";
  const [report, setReport] = useState<StoredReport | null>(null);
  const [toast, setToast] = useState("");
  const [toastShown, setToastShown] = useState(false);

  useEffect(() => {
    setReport(loadStoredReport(domain, includeSentiment));
  }, [domain, includeSentiment]);

  const state = report?.state ?? null;
  const userCompany: CompanyProfile = state?.comparison?.userCompany ?? state?.userCompany ?? {
    name: domain || "Target Company",
    domain: domain || "",
    category: "Company",
    offeringsSummary: "",
    stats: {
      foundedYear: undefined,
      employeeCount: undefined,
      fundingTotal: undefined,
      dataAvailability: { funding: false, revenue: false, employeeCount: false },
    },
  };

  const competitors: CompanyProfile[] = useMemo(() => {
    const rawList = state?.comparison?.competitors ?? state?.competitorProfiles ?? [];
    return rawList.filter((comp) => !isSameCompany(comp, userCompany));
  }, [state, userCompany]);

  const reportTitle = competitors.length > 0
    ? `${userCompany.name} vs. its competition`
    : `${userCompany.name} Market Profile`;

  const sentiment = state?.sentiment ?? [];
  const competitorSentiment = competitors.map((company) =>
    sentiment.find((item) => item.companyName.toLowerCase() === company.name.toLowerCase())
  );
  const scoredCompetitors = competitorSentiment.filter((item) => item?.dataAvailable).length;
  const sourcesCount = 1 + competitors.length * 3 + (includeSentiment ? scoredCompetitors : 0);

  function showToast(message: string) {
    setToast(message);
    setToastShown(true);
    window.setTimeout(() => setToastShown(false), 2600);
  }

  function copyReportLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast("Report link copied."));
    } else {
      showToast("Copy the page URL to share this report.");
    }
  }

  function backToRun() {
    const params = new URLSearchParams({ url: domain });
    if (includeSentiment) params.set("sentiment", "1");
    router.push(`/dashboard?${params.toString()}`);
  }

  function runAnother() {
    router.push("/");
  }

  return (
    <>
      <nav className="topbar">
        <div className="brand"><span className="dot" />FACTS</div>
        <div className="topbar-right">
          <div className="run-progress" aria-label="Step 3 of 3">
            <span className="step complete" />
            <span className="step complete" />
            <span className="step current" />
          </div>
          <button className="btn ghost" onClick={backToRun}>← Back to run</button>
          <button className="btn ghost" onClick={() => showToast("Export is ready to connect to your report service.")}>Export PDF</button>
        </div>
      </nav>

      <main className="page">
        <div className="page-inner wide">
          <div className="eyebrow">Competitor report <span className="eyebrow-muted">03 / 03</span></div>
          <div className="report-header">
            <div>
              <h1>{reportTitle}</h1>
              <p className="report-intro">A concise view of market overlap, positioning, and public signals.</p>
            </div>
            <div className="report-meta">
              <div>Generated<b>{formatDate(report?.generatedAt)}</b></div>
              <div>Sources<b>{sourcesCount} scraped</b></div>
              <div>Sentiment<b>{includeSentiment ? "Included" : "Not included"}</b></div>
            </div>
          </div>

          <div className="report-section">
            <h2>Company profiles</h2>
            {competitors.length > 0 ? (
              <div className="table-wrap">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>{userCompany.name} <span className="cite">Target</span></th>
                      {competitors.map((comp) => (
                        <th key={comp.name + comp.domain}>
                          {comp.name} {comp.domain ? <span className="cite">{comp.domain}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="metric">Founded</td>
                      <td>{formatStatValue(userCompany.stats.foundedYear)}</td>
                      {competitors.map((comp) => (
                        <td key={"founded-" + comp.name}>{formatStatValue(comp.stats.foundedYear)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="metric">Employees</td>
                      <td>{formatStatValue(userCompany.stats.employeeCount)}</td>
                      {competitors.map((comp) => (
                        <td key={"emp-" + comp.name}>{formatStatValue(comp.stats.employeeCount)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="metric">Funding</td>
                      <td>{formatStatValue(userCompany.stats.fundingTotal)}</td>
                      {competitors.map((comp) => (
                        <td key={"funding-" + comp.name}>{formatStatValue(comp.stats.fundingTotal)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="metric">Revenue</td>
                      <td>{formatStatValue(userCompany.stats.revenueEstimate)}</td>
                      {competitors.map((comp) => (
                        <td key={"rev-" + comp.name}>{formatStatValue(comp.stats.revenueEstimate)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="metric">Offerings / Model</td>
                      <td>{userCompany.offeringsSummary || "Target company offering"}</td>
                      {competitors.map((comp) => (
                        <td key={"offering-" + comp.name}>{comp.offeringsSummary || "Sourced company offering"}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-panel p-6 text-sm text-neutral-600">
                No direct market competitors identified for <strong>{userCompany.name}</strong>.
              </div>
            )}

            {state?.comparison?.gaps?.[0]?.missingRelativeToUser?.[0] ? (
              <div className="callout">
                <b>Key difference —</b> {state.comparison.gaps[0].missingRelativeToUser[0]}
              </div>
            ) : null}
          </div>

          {includeSentiment && (
            <div className="report-section" id="sentimentSection">
              <h2>Sentiment</h2>
              <div className="sentiment-grid">
                <div>
                  <SentimentRow company={userCompany.name} sentiment={sentiment.find((item) => item.companyName.toLowerCase() === userCompany.name.toLowerCase())} />
                  {competitors.map((company, index) => (
                    <SentimentRow key={company.name} company={company.name} sentiment={competitorSentiment[index]} />
                  ))}
                </div>
                <aside className="report-aside">
                  <span className="aside-label">Coverage</span>
                  <strong>{scoredCompetitors} / {competitors.length || 1}</strong>
                  <p>Competitors with verified public review data scored.</p>
                </aside>
              </div>
            </div>
          )}

          <div className="report-footer">
            <button className="btn ghost" onClick={copyReportLink}>Copy link</button>
            <button className="btn ghost" onClick={() => showToast("Export is ready to connect to your report service.")}>Export PDF</button>
            <button className="btn primary" onClick={runAnother}>Run another company <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </main>

      <div className={`toast${toastShown ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function SentimentRow({ company, sentiment }: { company: string; sentiment?: SentimentResult }) {
  if (!sentiment?.dataAvailable) {
    return (
      <div className="sentiment-row">
        <div className="sr-top"><span className="name">{company}</span><span className="score">—</span></div>
        <div className="sentiment-none">Insufficient public review data to score — too few reviews found to be reliable.</div>
      </div>
    );
  }

  const score = sentiment.sentimentScore ?? 0;
  return (
    <div className="sentiment-row">
      <div className="sr-top"><span className="name">{company}</span><span className="score">{score} / 100</span></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${score}%` }} /></div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<main className="page"><div className="page-inner">Loading…</div></main>}>
      <ReportPageInner />
    </Suspense>
  );
}
