"use client";

import { CompanyCard } from "@/components/CompanyCard";
import { readableScrape } from "@/lib/readable-scrape";
import type { CompanyProfile } from "@/lib/types";

type StageRecord = {
  stage: number;
  title: string;
  payload?: unknown;
};

const TITLES: Record<number, string> = {
  1: "Page scrape",
  2: "Company check",
  3: "Rival candidates",
  4: "Kept for scrape",
  5: "Rival sources",
  6: "Rival profiles",
  7: "Overlap",
  8: "Reviews"
};

export function StageOutputList({
  stages,
  failedStage,
  error,
  liveMessage,
  notices = []
}: {
  stages: StageRecord[];
  failedStage?: number | null;
  error?: string | null;
  liveMessage?: string | null;
  notices?: string[];
}) {
  if (!stages.length && !error && !liveMessage && !notices.length) {
    return (
      <p className="text-sm leading-6 text-muted">
        Finished steps appear here as a briefing, not a log dump.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {stages
        .slice()
        .sort((a, b) => a.stage - b.stage)
        .map((record) => (
          <article className="overflow-hidden rounded-xl border border-line bg-paper" key={record.stage}>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="font-mono text-[11px] font-medium text-accent">
                {String(record.stage).padStart(2, "0")}
              </span>
              <h3 className="text-sm font-semibold text-ink">
                {TITLES[record.stage] ?? `Step ${record.stage}`}
              </h3>
            </header>
            <div className="px-4 py-4">{renderPayload(record.stage, record.payload)}</div>
          </article>
        ))}

      {notices.length ? (
        <ul className="space-y-2">
          {notices.map((notice) => (
            <li
              className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm leading-6 text-ink"
              key={notice}
            >
              {notice}
            </li>
          ))}
        </ul>
      ) : null}

      {liveMessage && !error ? (
        <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">{liveMessage}</p>
      ) : null}

      {error ? (
        <article className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-4">
          <p className="font-mono text-[11px] font-medium text-coral">
            {failedStage ? `Step ${String(failedStage).padStart(2, "0")} failed` : "Run failed"}
          </p>
          <h3 className="mt-1 text-base font-semibold text-ink">The model did not return a usable profile</h3>
          <p className="mt-2 text-sm leading-6 text-ink">{error}</p>
          <p className="mt-2 text-sm text-muted">Earlier steps above are still valid. Run again from the URL field.</p>
        </article>
      ) : null}
    </div>
  );
}

function renderPayload(stage: number, payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return <p className="text-sm text-muted">No handoff for this step.</p>;
  }

  if (stage === 1) {
    const data = payload as { url?: string; chars?: number; content?: string; truncated?: boolean };
    const body = readableScrape(data.content ?? "", 2200);
    return (
      <div>
        <p className="text-sm text-muted">
          <a className="text-accent underline-offset-2 hover:underline" href={data.url} rel="noreferrer" target="_blank">
            {data.url}
          </a>
          <span className="ml-2 font-mono text-xs">{formatCount(data.chars)} characters</span>
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Read page text</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{body}</p>
        </details>
      </div>
    );
  }

  if (stage === 2) {
    const data = payload as {
      siteKind?: string;
      reason?: string;
      profile?: CompanyProfile | null;
    };
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">{labelKind(data.siteKind)}</p>
        {data.reason ? <p className="text-sm leading-6 text-muted">{data.reason}</p> : null}
        {data.profile ? <CompanyCard company={data.profile} featured /> : null}
      </div>
    );
  }

  if (stage === 3) {
    const data = payload as { candidates?: Array<{ name: string; domain?: string }> };
    return <NameDomainList items={data.candidates ?? []} />;
  }

  if (stage === 4) {
    const data = payload as { ranked?: Array<{ name: string; domain: string }> };
    return <NameDomainList items={data.ranked ?? []} ranked />;
  }

  if (stage === 5) {
    const data = payload as {
      scrapes?: Array<{
        name: string;
        domain: string;
        sources: Record<string, { chars: number; preview: string } | null>;
      }>;
    };
    return (
      <div className="space-y-6">
        {(data.scrapes ?? []).map((scrape) => {
          const found = Object.entries(scrape.sources).filter(([, body]) => body);
          const missing = Object.entries(scrape.sources)
            .filter(([, body]) => !body)
            .map(([source]) => source);
          return (
            <div key={scrape.domain}>
              <p className="text-sm font-semibold text-ink">{scrape.name}</p>
              <p className="font-mono text-xs text-muted">{scrape.domain}</p>
              <div className="mt-3 overflow-hidden rounded-lg border border-line">
                {found.map(([source, body], index) =>
                  body ? (
                    <details
                      className={index === 0 ? "" : "border-t border-line"}
                      key={source}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="font-medium capitalize text-ink">{source}</span>
                        <span className="font-mono text-xs text-muted">{formatCount(body.chars)} chars</span>
                      </summary>
                      <p className="border-t border-line bg-panel px-3 py-3 text-sm leading-6 text-muted">
                        {readableScrape(body.preview, 700)}
                      </p>
                    </details>
                  ) : null
                )}
              </div>
              {missing.length ? (
                <p className="mt-2 text-xs text-muted">No record on {missing.join(", ")}.</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (stage === 6) {
    const data = payload as { profiles?: CompanyProfile[] };
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {(data.profiles ?? []).map((profile) => (
          <CompanyCard company={profile} key={profile.domain} />
        ))}
      </div>
    );
  }

  if (stage === 7) {
    const data = payload as {
      serviceOverlap?: Array<{ service: string; companies: string[] }>;
      gaps?: Array<{ company: string; missingRelativeToUser: string[] }>;
    };
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-ink">Shared offerings</h4>
          <ul className="mt-2 space-y-2">
            {(data.serviceOverlap ?? []).map((row) => (
              <li className="text-sm leading-6" key={row.service}>
                <span className="font-medium text-ink">{row.service}</span>
                <span className="text-muted"> {row.companies.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink">Gaps vs you</h4>
          <ul className="mt-2 space-y-2">
            {(data.gaps ?? []).map((row) => (
              <li className="text-sm leading-6" key={row.company}>
                <span className="font-medium text-ink">{row.company}</span>
                <span className="text-muted"> missing {row.missingRelativeToUser.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (stage === 8) {
    const data = payload as {
      sentiment?: Array<{
        companyName: string;
        summary: string;
        sentimentScore?: number;
        dataAvailable: boolean;
      }>;
    };
    return (
      <ul className="grid gap-3 md:grid-cols-2">
        {(data.sentiment ?? []).map((item) => (
          <li className="rounded-lg border border-line bg-panel p-4" key={item.companyName}>
            <p className="font-semibold text-ink">{item.companyName}</p>
            <p className="mt-1 font-mono text-xs text-muted">
              {item.dataAvailable && item.sentimentScore !== undefined
                ? `${item.sentimentScore}/100`
                : "Not enough public reviews"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>
          </li>
        ))}
      </ul>
    );
  }

  return <p className="text-sm text-muted">Handoff recorded.</p>;
}

function NameDomainList({
  items,
  ranked = false
}: {
  items: Array<{ name: string; domain?: string }>;
  ranked?: boolean;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted">No names in this handoff.</p>;
  }

  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {items.map((item, index) => (
        <li className="rounded-lg border border-line bg-panel px-3 py-2" key={`${item.name}-${item.domain ?? index}`}>
          <p className="text-sm font-medium text-ink">
            {ranked ? `${index + 1}. ` : ""}
            {item.name}
          </p>
          <p className="font-mono text-xs text-muted">{item.domain ?? "domain not resolved"}</p>
        </li>
      ))}
    </ol>
  );
}

function formatCount(value?: number) {
  if (!value) {
    return "0";
  }
  return value.toLocaleString("en-US");
}

function labelKind(kind: string | undefined) {
  if (kind === "company") {
    return "This is a company. Discovery will run.";
  }
  if (kind === "personal_profile") {
    return "This is a personal profile. No competitors.";
  }
  if (kind === "not_a_company") {
    return "This is not a company homepage. No competitors.";
  }
  return "Classification unavailable.";
}
