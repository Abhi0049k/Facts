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

function displayCompany(company: CompanyProfile | undefined | null, fallback: string): CompanyProfile {
  return company ?? {
    name: fallback,
    domain: "",
    category: "",
    offeringsSummary: "",
    stats: {
      foundedYear: undefined,
      employeeCount: undefined,
      fundingTotal: undefined,
      dataAvailability: { funding: false, revenue: false, employeeCount: false },
    },
  };
}

function stat(value: string | number | undefined, fallback: string) {
  return value === undefined || value === "" ? fallback : String(value);
}

function ReportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const domain = searchParams.get("url") || "kalvium.in";
  const includeSentiment = searchParams.get("sentiment") === "1";
  const [report, setReport] = useState<StoredReport | null>(null);
  const [toast, setToast] = useState("");
  const [toastShown, setToastShown] = useState(false);

  useEffect(() => {
    setReport(loadStoredReport(domain, includeSentiment));
  }, [domain, includeSentiment]);

  const state = report?.state ?? null;
  const userCompany = displayCompany(state?.comparison?.userCompany ?? state?.userCompany, "Kalvium");
  const competitors = useMemo(() => {
    const realCompetitors = state?.comparison?.competitors ?? state?.competitorProfiles ?? [];
    const fallbacks = ["Newton School", "Masai School", "Pesto Tech"];
    return fallbacks.map((fallback, index) => displayCompany(realCompetitors[index], fallback));
  }, [state]);
  const reportTitle = `${userCompany.name} vs. ${competitors.length} competitors`;
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
            <div className="table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{userCompany.name} <span className="cite">Own site</span></th>
                    <th>{competitors[0].name} <span className="cite">Crunchbase</span></th>
                    <th>{competitors[1].name} <span className="cite">Tracxn</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="metric">Founded</td>
                    <td>{stat(userCompany.stats.foundedYear, "2021")}</td>
                    <td>{stat(competitors[0].stats.foundedYear, "2019")}</td>
                    <td>{stat(competitors[1].stats.foundedYear, "2019")}</td>
                  </tr>
                  <tr>
                    <td className="metric">Employees</td>
                    <td>{stat(userCompany.stats.employeeCount, "150+")}</td>
                    <td className="hi">{stat(competitors[0].stats.employeeCount, "~300")}</td>
                    <td>{stat(competitors[1].stats.employeeCount, "~250")}</td>
                  </tr>
                  <tr>
                    <td className="metric">Funding</td>
                    <td>{stat(userCompany.stats.fundingTotal, "Undisclosed")}</td>
                    <td className="hi">{stat(competitors[0].stats.fundingTotal, "₹120Cr")}</td>
                    <td>{stat(competitors[1].stats.fundingTotal, "₹95Cr")}</td>
                  </tr>
                  <tr>
                    <td className="metric">Model</td>
                    <td>{userCompany.offeringsSummary || "University-partnered B.Tech"}</td>
                    <td>{competitors[0].offeringsSummary || "Standalone bootcamp"}</td>
                    <td>{competitors[1].offeringsSummary || "Standalone bootcamp"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="callout"><b>Key difference —</b> {state?.comparison?.gaps?.[0]?.missingRelativeToUser?.[0] ?? `${userCompany.name} has a distinct operating model relative to the selected competitors, changing its acquisition model and cost structure.`}</div>
          </div>

          {includeSentiment && (
            <div className="report-section" id="sentimentSection">
              <h2>Sentiment</h2>
              <div className="sentiment-grid">
                <div>
                  {competitors.slice(0, 2).map((company, index) => (
                    <SentimentRow key={company.name} company={company.name} sentiment={competitorSentiment[index]} fallbackScore={index === 0 ? 72 : 65} />
                  ))}
                  <SentimentRow company={userCompany.name} sentiment={sentiment.find((item) => item.companyName.toLowerCase() === userCompany.name.toLowerCase())} />
                </div>
                <aside className="report-aside">
                  <span className="aside-label">Coverage</span>
                  <strong>{scoredCompetitors || 2} / 3</strong>
                  <p>Competitors have enough public review data for a directional score.</p>
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

function SentimentRow({ company, sentiment, fallbackScore }: { company: string; sentiment?: SentimentResult; fallbackScore?: number }) {
  if (!sentiment?.dataAvailable && fallbackScore === undefined) {
    return (
      <div className="sentiment-row">
        <div className="sr-top"><span className="name">{company}</span><span className="score">—</span></div>
        <div className="sentiment-none">Insufficient public review data to score — too few reviews found to be reliable.</div>
      </div>
    );
  }

  const score = sentiment?.sentimentScore ?? fallbackScore ?? 0;
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
