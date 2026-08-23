# Facts

Facts is a Next.js full-stack web application for automated competitor discovery, comparison, and market research from a single company URL. Tagline: **AI-powered competitor intelligence, grounded in real data**.

## System Architecture

```mermaid
graph TD
    A[User] -->|1. Enter URL| B[Home Page /]
    B -->|2. Submit URL| C[Dashboard /dashboard?url=...]
    C -->|3. SSE Stream| D[API /api/analyze]
    D -->|Pipeline| E[Pipeline Orchestrator]
    
    E --> F[Stage 0: Lookup]
    F -->|DB Hit| G[Cached Company Data]
    F -->|DB Miss| H[Stage 1: Ingest]
    H --> I[Bright Data Web Unlocker]
    I --> J[Stage 2: Understand]
    J --> K[LLM (Ollama)]
    K --> L[Stage 3: Discover]
    L --> M[Tavily Search + LLM]
    M --> N[Stage 4: Rank]
    N --> O[LLM Ranking]
    O --> P[Stage 5: Scrape]
    P --> Q[Bright Data Datasets v3]
    Q --> R[Stage 6: Extract]
    R --> S[LLM Extraction]
    S --> T[Stage 7: Compare]
    T --> U[LLM Comparison]
    U --> V[Stage 8: Sentiment]
    V --> W[Tavily + LLM]
    
    E --> X[SSE Events]
    X --> C[Dashboard UI]
    C --> Y[Summary Panel]
    C --> Z[Results Page /results]
    
    style A fill:#f5f8ff,stroke:#2457d6
    style E fill:#e9efff,stroke:#2457d6
    style C fill:#e8f7f2,stroke:#168a71
    style Z fill:#e8f7f2,stroke:#168a71
```

## Architecture Overview

Facts uses a fixed-sequence pipeline, not an autonomous agent. Each stage takes a defined input, returns structured JSON, and writes to a shared `PipelineState`. This keeps behavior deterministic, controls external API cost, and makes failures easier to reason about.

```text
0. Lookup (Postgres)
   URL -> normalize domain -> Company + CompanySource cache
        |
1. Ingest User Company
   known info URLs or homepage -> Bright Data scrape -> rawContent
        |
2. Understand Company
   rawContent -> LLM JSON -> CompanyProfile
        |
3. Discover Competitors
   searchIntentPhrase -> LLM-native candidates + Tavily enrichment -> raw candidates
        |
4. Rank & Select Competitors
   raw candidates + CompanyProfile -> LLM ranking -> top 5 competitors
        |
5. Scrape Competitors
   competitor domains -> Bright Data fan-out -> source content per competitor
        |
6. Extract Structured Data
   scraped source content -> LLM JSON -> competitor CompanyProfile[]
        |
7. Comparison
   user CompanyProfile + competitors -> LLM JSON -> ComparisonResult
        |
8. Sentiment Optional
   company names/domains -> Tavily review search + LLM scoring -> SentimentResult[]
```

## Folder Structure

```text
facts/
├── app/                            # Next.js App Router pages and API routes
│   ├── page.tsx                    # Home: paste a company URL
│   ├── dashboard/
│   │   └── page.tsx                # Pipeline progress and analysis run
│   ├── results/
│   │   └── page.tsx                # Comparison report (redirects to dashboard)
│   ├── api/
│   │   ├── analyze/
│   │   │   └── route.ts            # Main orchestrating endpoint (SSE)
│   │   └── cache/
│   │       └── clear/
│   │           └── route.ts        # Cache clearing endpoint
│   ├── layout.tsx                  # Root layout, fonts, providers
│   ├── page.tsx                    # Home page
│   ├── providers.tsx               # Context providers (App, Toast, Pipeline)
│   ├── globals.css                 # Design tokens, base styles
│   └── providers.tsx               # Context providers wrapper
├── components/
│   ├── layout/                     # Layout components
│   │   ├── PageShell.tsx
│   │   └── TopNav.tsx
│   ├── providers/                  # Context providers
│   │   ├── AppProvider.tsx         # App state (page, domain, sentiment)
│   │   └── PipelineProvider.tsx    # Pipeline state & animation
│   ├── ui/                         # Reusable UI primitives
│   │   ├── Badge.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Callout.tsx
│   │   ├── Card.tsx
│   │   ├── ChipRow.tsx
│   │   ├── Eyebrow.tsx
│   │   ├── Input.tsx
│   │   ├── MiniChip.tsx
│   │   ├── Pill.tsx
│   │   ├── ProofCard.tsx
│   │   ├── Sentiment.tsx
│   │   ├── StageRow.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── SummaryPanel.tsx
│   │   ├── Table.tsx
│   │   ├── Toggle.tsx
│   │   ├── Toast.tsx
│   │   ├── TopNav.tsx
│   │   └── ProofCard.tsx
│   ├── providers/                  # Context providers
│   │   ├── AppProvider.tsx
│   │   └── PipelineProvider.tsx
│   ├── layout/                     # Layout components
│   │   ├── PageShell.tsx
│   │   └── TopNav.tsx
│   ├── ui/                         # Reusable UI primitives
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Callout.tsx
│   │   ├── Card.tsx
│   │   ├── ChipRow.tsx
│   │   ├── Eyebrow.tsx
│   │   ├── Input.tsx
│   │   ├── MiniChip.tsx
│   │   ├── Pill.tsx
│   │   ├── ProofCard.tsx
│   │   ├── Sentiment.tsx
│   │   ├── StageRow.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── SummaryPanel.tsx
│   │   ├── Table.tsx
│   │   ├── Toggle.tsx
│   │   ├── Toast.tsx
│   │   ├── TopNav.tsx
│   │   └── ProofCard.tsx
│   ├── ComparisonChart.tsx
│   ├── ComparisonTable.tsx
│   ├── CompanyCard.tsx
│   ├── LimitedDataBanner.tsx
│   ├── MarkdownReport.tsx
│   ├── PipelineProgress.tsx
│   ├── SiteHeader.tsx
│   ├── StageOutputList.tsx
│   ├── UrlEntry.tsx
│   └── CompanyCard.tsx
├── lib/                            # Shared backend services and types
│   ├── pipeline/                   # One pure pipeline function per stage
│   │   ├── 0-lookup.ts
│   │   ├── 1-ingest.ts
│   │   ├── 2-understand.ts
│   │   ├── 3-discover.ts
│   │   ├── 4-rank.ts
│   │   ├── 5-scrape-competitors.ts
│   │   ├── 6-extract.ts
│   │   ├── 7-compare.ts
│   │   ├── 8-sentiment.ts
│   │   ├── cache.ts
│   │   ├── classify-site.ts
│   │   ├── enrichment.ts
│   │   ├── notices.ts
│   │   ├── pipeline-events.ts
│   │   └── run.ts
│   ├── clients/                    # External service clients
│   │   ├── brightdata.ts
│   │   ├── llm.ts
│   │   ├── logger.ts
│   │   ├── normalize-json.ts
│   │   ├── prisma.ts
│   │   ├── supabase.ts
│   │   ├── tavily.ts
│   │   └── normalize-json.ts
│   ├── providers/                  # Context providers
│   │   ├── AppProvider.tsx
│   │   └── PipelineProvider.tsx
│   ├── pipeline/                   # Pipeline orchestration
│   │   ├── 0-lookup.ts
│   │   ├── 1-ingest.ts
│   │   ├── 2-understand.ts
│   │   ├── 3-discover.ts
│   │   ├── 4-rank.ts
│   │   ├── 5-scrape-competitors.ts
│   │   ├── 6-extract.ts
│   │   ├── 7-compare.ts
│   │   ├── 8-sentiment.ts
│   │   ├── cache.ts
│   │   ├── classify-site.ts
│   │   ├── enrichment.ts
│   │   ├── notices.ts
│   │   ├── pipeline-events.ts
│   │   └── run.ts
│   ├── clients/                    # External service clients
│   │   ├── brightdata.ts
│   │   ├── llm.ts
│   │   ├── logger.ts
│   │   ├── normalize-json.ts
│   │   ├── prisma.ts
│   │   ├── supabase.ts
│   │   ├── tavily.ts
│   │   └── normalize-json.ts
│   ├── providers/                  # Context providers
│   │   ├── AppProvider.tsx
│   │   └── PipelineProvider.tsx
│   ├── pipeline/                   # Pipeline stages
│   │   ├── 0-lookup.ts
│   │   ├── 1-ingest.ts
│   │   ├── 2-understand.ts
│   │   ├── 3-discover.ts
│   │   ├── 4-rank.ts
│   │   ├── 5-scrape-competitors.ts
│   │   ├── 6-extract.ts
│   │   ├── 7-compare.ts
│   │   ├── 8-sentiment.ts
│   │   ├── cache.ts
│   │   ├── classify-site.ts
│   │   ├── enrichment.ts
│   │   ├── notices.ts
│   │   ├── pipeline-events.ts
│   │   └── run.ts
│   ├── clients/                    # External service clients
│   │   ├── brightdata.ts
│   │   ├── llm.ts
│   │   ├── logger.ts
│   │   ├── normalize-json.ts
│   │   ├── prisma.ts
│   │   ├── supabase.ts
│   │   ├── tavily.ts
│   │   └── normalize-json.ts
│   ├── providers/                  # Context providers
│   │   ├── AppProvider.tsx
│   │   └── PipelineProvider.tsx
│   ├── pipeline/                   # Pipeline stages
│   │   ├── 0-lookup.ts
│   │   ├── 1-ingest.ts
│   │   ├── 2-understand.ts
│   │   ├── 3-discover.ts
│   │   ├── 4-rank.ts
│   │   ├── 5-scrape-competitors.ts
│   │   ├── 6-extract.ts
│   │   ├── 7-compare.ts
│   │   ├── 8-sentiment.ts
│   │   ├── cache.ts
│   │   ├── classify-site.ts
│   │   ├── enrichment.ts
│   │   ├── notices.ts
│   │   ├── pipeline-events.ts
│   │   └── run.ts
│   ├── types.ts                    # Shared TypeScript schemas
│   ├── utils.ts                    # Utility functions (cn, etc.)
│   ├── client/                     # Client-side utilities
│   │   └── read-analyze-stream.ts
│   ├── pipeline-events.ts          # SSE event types
│   ├── readable-scrape.ts          # Scrape text cleaning
│   ├── stage-number.ts             # Stage numbering utilities
│   └── normalize-domain.ts         # Domain normalization
├── prisma/                         # Company cache schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── data/                           # Indian company CSV batches (imported into Postgres)
├── scripts/                        # CSV import, Bright Data tests, screenshots
│   ├── import-companies.ts
│   ├── import-linkedin-xlsx.ts
│   ├── test-brightdata.ts
│   └── take-screenshots.ts
├── public/
│   ├── images/
│   │   ├── hero-desk.png
│   │   └── method-paper.png
│   └── screenshots/                # Application screenshots
│       ├── landing.png
│       ├── progress.png
│       └── results.png
├── .env.example                    # Required environment variables template
├── .env.local                      # Local environment variables (gitignored)
├── .env                            # Environment variables (gitignored)
├── .gitignore
├── next.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next-env.d.ts
└── README.md                       # Project documentation
```

## Setup Instructions

Create a `.env.local` file using `.env.example` as the template:

```bash
TAVILY_API_KEY=
BRIGHT_DATA_API_TOKEN=
BRIGHT_DATA_WEB_UNLOCKER_ZONE=web_unlocker1
BRIGHT_DATA_COLLECTOR_COMPANY_SITE=
BRIGHT_DATA_COLLECTOR_CRUNCHBASE=gd_l1vijqt9jfj7olije
BRIGHT_DATA_COLLECTOR_LINKEDIN=gd_l1vikfnt1wgvvqz95w
BRIGHT_DATA_COLLECTOR_TOFLER=
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3.2:latest
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
```

Local LLM prerequisites:

- Install Ollama and keep it running locally with `ollama serve` on the default port `11434`.
- Pull the default model with `ollama pull llama3.2:latest`.
- Override `LLM_MODEL` in `.env.local` if you prefer another local tag.

Then install dependencies and run the app:

```bash
npm install
npm run dev
```

Open `/` and paste a company homepage. That sends you to `/dashboard?url=...`, where the pipeline runs. The dashboard shows each stage's output (including the scraped page). If the company is not in the Postgres cache, a dismissible banner explains that results use live discovery. If stage 2 decides the URL is a person or not a company, discovery stops with a message. If it is a company, you can open `/results` after the run finishes.

Load company CSV batches into Supabase after Prisma migrate:

```bash
npx prisma migrate deploy
npx tsx scripts/import-companies.ts data/indian_origin_organisations_batch_002.csv
```

## App URLs

| URL | File | What it does |
| --- | --- | --- |
| `GET /` | `app/page.tsx` | Home. Paste a company URL. |
| `GET /dashboard` | `app/dashboard/page.tsx` | Live pipeline. Reads `?url=` and optional `?sentiment=1`, then POST `/api/analyze`. |
| `GET /results` | `app/results/page.tsx` | Redirects to dashboard with URL params. |
| `POST /api/analyze` | `app/api/analyze/route.ts` | SSE endpoint. Normalizes the URL, runs `lib/pipeline/run.ts`, streams stage events. |
| `POST /api/cache/clear` | `app/api/cache/clear/route.ts` | Clears workflow cache. |

Shared chrome: `app/layout.tsx` (fonts, metadata), `components/layout/TopNav.tsx`.

## Which File Does What

### Pages and API

- `app/layout.tsx`: root HTML, fonts, global CSS, providers.
- `app/page.tsx`: marketing home and URL entry form.
- `app/dashboard/page.tsx`: live pipeline progress, animated stages, summary panel.
- `app/results/page.tsx`: redirects to dashboard with URL params.
- `app/api/analyze/route.ts`: `POST /api/analyze` SSE (`text/event-stream`).
- `app/api/cache/clear/route.ts`: cache clearing endpoint.

### Pipeline (one stage per file)

- `lib/pipeline/run.ts`: ordered stages, emits start/complete payloads, stops after stage 2 when the page is not a company.
- `lib/pipeline/0-lookup.ts`: match the URL against `Company.primaryDomain` before scraping.
- `lib/pipeline/1-ingest.ts`: scrapes known info URLs when lookup hits; otherwise the homepage via Bright Data.
- `lib/pipeline/classify-site.ts`: URL heuristics (LinkedIn `/in/`, social profiles, Wikipedia) as a hint for stage 2.
- `lib/pipeline/2-understand.ts`: LLM reads the scrape, sets `siteKind` (`company`, `personal_profile`, `not_a_company`), and only then builds a `CompanyProfile`.
- `lib/pipeline/3-discover.ts`: candidate rivals from the local model plus optional Tavily.
- `lib/pipeline/4-rank.ts`: top five domains.
- `lib/pipeline/5-scrape-competitors.ts`: Unlocker homepages plus Crunchbase/LinkedIn/Tracxn/Tofler datasets.
- `lib/pipeline/6-extract.ts`: competitor `CompanyProfile[]`.
- `lib/pipeline/7-compare.ts`: overlap and gaps.
- `lib/pipeline/8-sentiment.ts`: known sentiment URLs from the database when present; otherwise Tavily. Empty verified list reports "No sentiment sources available for this company."

### Clients and UI Helpers

- `lib/clients/brightdata.ts`: Unlocker, Datasets v3, DCA collectors.
- `lib/clients/llm.ts`: Ollama JSON calls with structured output validation.
- `lib/clients/tavily.ts`: web search.
- `lib/clients/prisma.ts`: Prisma singleton for Stage 0 lookup.
- `lib/clients/normalize-json.ts`: unwrap messy LLM lists.
- `lib/pipeline-events.ts`: SSE event types (`stage`, `halted`, `done`, `error`).
- `lib/client/read-analyze-stream.ts`: browser SSE parser.
- `lib/types.ts`: shared TypeScript types.
- `components/ui/StageRow.tsx`: animated pipeline stage row.
- `components/ui/ProofCard.tsx`: side proof card for home page.
- `components/ui/SummaryPanel.tsx`: completion summary with CTA.
- `components/ui/ProofCard.tsx`: side proof card for home page.
- `components/ui/Sentiment.tsx`: sentiment visualization components.

### How Company vs Person is Decided

1. Stage 1 only scrapes. The dashboard shows that scrape (truncated if long).
2. Stage 2 combines the URL hint with the scrape. A LinkedIn `/in/` URL, a personal portfolio, or a Wikipedia article is not treated as a company.
3. If `siteKind` is `personal_profile` or `not_a_company`, the stream sends `halted` and later stages do not run.
4. If it is a `company`, discovery continues as before.

The LLM pipeline uses LangChain with a local Ollama model. Bright Data needs an API token plus a Web Unlocker zone (homepages) and/or dataset IDs (Crunchbase, LinkedIn).

## Setting up Bright Data

Facts uses three Bright Data products, routed by ID prefix:

| Source | Env var | Default | API |
| --- | --- | --- | --- |
| Company homepages | `BRIGHT_DATA_WEB_UNLOCKER_ZONE` | your Unlocker zone name | `POST /request` (markdown) |
| Company homepages (optional) | `BRIGHT_DATA_COLLECTOR_COMPANY_SITE` | empty | `gd_…` Datasets v3 or `c_…` Scraper Studio |
| Crunchbase | `BRIGHT_DATA_COLLECTOR_CRUNCHBASE` | `gd_l1vijqt9jfj7olije` | Datasets v3 |
| LinkedIn companies | `BRIGHT_DATA_COLLECTOR_LINKEDIN` | `gd_l1vikfnt1wgvvqz95w` | Datasets v3 |
| Tofler (optional) | `BRIGHT_DATA_COLLECTOR_TOFLER` | empty | Datasets v3 or collector |

1. Create an API key under [account users](https://brightdata.com/cp/setting/users) and set `BRIGHT_DATA_API_TOKEN`.
2. Create a [Web Unlocker](https://brightdata.com/cp/web_access) zone. Copy the **zone name** from the Overview tab into `BRIGHT_DATA_WEB_UNLOCKER_ZONE`, or leave it blank and Facts will use the first active `unblocker` zone on the account.
3. Leave the Crunchbase and LinkedIn dataset IDs as the published library scrapers, or replace them with your own `c_…` Scraper Studio collectors.
4. Leave `BRIGHT_DATA_COLLECTOR_TOFLER` empty unless you need India filings.

Do not put placeholder `c_xxxxxxxxxxxxxxxx` values in `.env.local`. Next.js loads `.env.local` over `.env`, so placeholders hide real IDs.

`gd_…` IDs call `POST /datasets/v3/scrape`. If Bright Data returns HTTP 202, the client polls `/datasets/v3/progress/{snapshot_id}` and downloads `/datasets/v3/snapshot/{snapshot_id}`. `c_…` IDs use `/dca/trigger` and `/dca/dataset`. The client never sends a collector ID to the Datasets API.

Stage 5 looks up canonical Crunchbase/LinkedIn URLs with Tavily when a key is set, then batches those URLs (up to 20) in one dataset request. Homepages go through Web Unlocker with a concurrency limit of 3.

Before running the full pipeline, test homepage scraping:

```bash
npm run test:brightdata
```

This hits Kalvium by default (`BRIGHT_DATA_TEST_URL` to override), prints the markdown or JSON, and checks that Stage 2 can use it as `rawContent`.

A Cursor MCP SSE URL (`.cursor/mcp.json`, gitignored) is only for the IDE agent. The Facts pipeline does not call MCP.

## Pipeline Stage Reference

| Stage | Input | Output | External Service |
| --- | --- | --- | --- |
| 1. Ingest User Company | Company URL | `rawContent: string` (shown on the dashboard) | Bright Data Web Unlocker |
| 2. Understand Company | scrape + URL hint | `siteKind` + `CompanyProfile` or halt | LLM (Ollama) |
| 3. Discover Competitors | `searchIntentPhrase` | `{ name, domain? }[]` | LLM + Tavily |
| 4. Rank & Select Competitors | Raw candidates + `CompanyProfile` | `Competitor[]` max 5 | LLM |
| 5. Scrape Competitors | Competitor domains | Raw content per competitor/source | Bright Data Datasets v3 |
| 6. Extract Structured Data | Competitor source content | `CompanyProfile[]` | LLM |
| 7. Comparison | User profile + competitor profiles | `ComparisonResult` | LLM |
| 8. Sentiment Optional | Company name + domain | `SentimentResult[]` | Tavily + LLM |

## Screenshots

### Home Page
![Landing page](./public/screenshots/landing.png)

### Pipeline in Progress
![Pipeline in progress](./public/screenshots/progress.png)

### Results Dashboard
![Results dashboard](./public/screenshots/results.png)

## Known Limitations

Financial and revenue data is often unavailable for smaller private companies, especially when public MCA-style filings or funding databases do not expose usable details. Sentiment analysis is optional and depends on public review source availability; when evidence is sparse, Facts returns an explicit insufficient-data state rather than forcing a score.