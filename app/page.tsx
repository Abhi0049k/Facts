import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { UrlEntry } from "@/components/UrlEntry";

const METHOD = [
  { name: "Ingest", detail: "Unlock the homepage and keep the readable page, not a summary." },
  { name: "Profile", detail: "Turn that page into a structured company record." },
  { name: "Discover", detail: "Find likely rivals from the business model, not keyword ads." },
  { name: "Rank", detail: "Keep at most five domains that actually compete." },
  { name: "Scrape", detail: "Pull live pages for those rivals, plus funding and headcount when IDs exist." },
  { name: "Extract", detail: "Normalize offerings, stats, and gaps into the same schema." },
  { name: "Compare", detail: "Show overlap and what each rival still lacks." }
];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-12 pt-10 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center lg:gap-16">
        <section className="rise max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl md:leading-[1.08]">
            See who actually competes with your company
          </h1>
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-muted">
            Paste a homepage. Facts scrapes live pages, ranks rivals, and maps overlap.
          </p>
          <UrlEntry />
        </section>

        <div className="rise relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-panel lg:aspect-auto lg:min-h-[22rem]">
          <Image
            alt="Research desk with a laptop open to a competitor comparison"
            className="object-cover"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 22rem"
            src="/images/hero-desk.png"
          />
        </div>
      </main>

      <section className="border-t border-line" id="method">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="max-w-[16ch] text-3xl font-semibold tracking-tight text-ink">
            One URL in. A briefing out.
          </h2>
          <p className="mt-4 max-w-[65ch] text-sm leading-6 text-muted">
            Facts is a fixed pipeline, not an agent that wanders the web. Each step writes JSON the
            next step can trust, so cost and failure points stay visible. Homepages go through Bright
            Data Web Unlocker. The local model only structures what was scraped.
          </p>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_minmax(0,18rem)] lg:items-start">
            <ol className="space-y-5">
              {METHOD.map((step, index) => (
                <li className="grid grid-cols-[4.5rem_1fr] gap-4" key={step.name}>
                  <span className="pt-0.5 font-mono text-xs text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{step.name}</div>
                    <p className="mt-1 text-sm leading-6 text-muted">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-line bg-panel lg:max-w-none">
              <Image
                alt="Stacked reports and a folded market map on a desk"
                className="object-cover"
                fill
                sizes="(max-width: 1024px) 20rem, 18rem"
                src="/images/method-paper.png"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
