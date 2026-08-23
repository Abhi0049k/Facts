"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_URL = "https://kalvium.com/";
const URL_ERROR = "Enter a valid website or domain, such as https://kalvium.com/.";

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname.includes(".") || !/[a-z]/i.test(parsed.hostname)) return null;
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [companyUrl, setCompanyUrl] = useState(DEMO_URL);
  const [includeSentiment, setIncludeSentiment] = useState(false);
  const [error, setError] = useState(false);

  function useDemo() {
    setCompanyUrl(DEMO_URL);
    setError(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeUrl(companyUrl);
    if (!normalized) {
      setError(true);
      inputRef.current?.focus();
      return;
    }

    setError(false);
    const params = new URLSearchParams({ url: normalized });
    if (includeSentiment) params.set("sentiment", "1");
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <>
      <nav className="topbar">
        <div className="brand"><span className="dot" />FACTS</div>
        <div className="crumb"><b>Home</b><span> / Start a run</span></div>
        <div className="topbar-right"><span className="domain-pill">Private beta</span></div>
      </nav>

      <main className="page">
        <div className="page-inner hero">
          <div className="eyebrow">Competitor intelligence <span className="eyebrow-muted">01 / 03</span></div>
          <div className="hero-layout">
            <div>
              <h1>Know your competitors <em>before they know you're looking.</em></h1>
              <p className="sub">Turn a company's public footprint into a focused, side-by-side view of the market. Start with a URL and let Facts surface the companies that matter.</p>

              <div className="input-card">
                <form className="url-form" onSubmit={onSubmit}>
                  <input
                    ref={inputRef}
                    type="text"
                    id="companyUrl"
                    placeholder="Enter a company website"
                    aria-label="Company website"
                    value={companyUrl}
                    autoComplete="url"
                    onChange={(event) => {
                      setCompanyUrl(event.target.value);
                      if (error) setError(false);
                    }}
                  />
                  <button type="submit">Track competitors <span aria-hidden="true">→</span></button>
                </form>
                <div className="form-helper">
                  <span>Try the demo with any public company site.</span>
                  <button type="button" onClick={useDemo}>Use demo URL</button>
                </div>
                <div className={`url-error${error ? " visible" : ""}`} role="alert">{URL_ERROR}</div>
              </div>

              <div className="option-row">
                <div className="option-copy">
                  <div className="t">Include sentiment analysis</div>
                  <div className="d">Scan reviews and public discussion for the company and its competitors. Optional when there is not enough public data.</div>
                </div>
                <label className="switch" aria-label="Include sentiment analysis">
                  <input
                    type="checkbox"
                    id="sentimentToggle"
                    checked={includeSentiment}
                    onChange={(event) => setIncludeSentiment(event.target.checked)}
                  />
                  <span className="track"><span className="knob" /></span>
                </label>
              </div>

              <div className="hero-note">No account needed to try it once · Results are based on public sources</div>
            </div>

            <aside className="proof-card" aria-label="What Facts delivers">
              <span className="proof-kicker">One run delivers</span>
              <strong>3 → 1</strong>
              <p>Three relevant competitors distilled into one clear comparison.</p>
              <div className="proof-list">
                <span>Verified public sources</span>
                <span>Structured market signals</span>
                <span>Report-ready output</span>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
