"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function UrlEntry() {
  const router = useRouter();
  const [companyUrl, setCompanyUrl] = useState("");
  const [includeSentiment, setIncludeSentiment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = companyUrl.trim();
    if (!trimmed) {
      setError("Paste a company homepage first.");
      return;
    }
    const params = new URLSearchParams({ url: trimmed });
    if (includeSentiment) {
      params.set("sentiment", "1");
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <form className="mt-8 flex max-w-xl flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink" htmlFor="home-company-url">
          Company URL
        </label>
        <input
          autoFocus
          className="h-12 rounded-lg border border-line bg-panel px-3 text-[15px] text-ink outline-none placeholder:text-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          id="home-company-url"
          onChange={(event) => {
            setCompanyUrl(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          placeholder="kalvium.com"
          type="text"
          value={companyUrl}
        />
        {error ? <p className="text-sm text-coral">{error}</p> : null}
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
        <input
          checked={includeSentiment}
          className="h-4 w-4 accent-accent"
          onChange={(event) => setIncludeSentiment(event.target.checked)}
          type="checkbox"
        />
        Include public-review sentiment
      </label>

      <button
        className="inline-flex h-12 w-fit items-center gap-2 rounded-lg bg-[#236b5b] px-5 text-sm font-semibold text-[#f3f4ee] transition hover:bg-[#1a5246] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        disabled={!companyUrl.trim()}
        type="submit"
      >
        Open dashboard
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
