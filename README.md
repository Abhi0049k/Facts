# Facts

Facts is a Next.js full-stack web application for automated competitor discovery, comparison, and market research from a single company URL. Tagline: **AI-powered competitor intelligence, grounded in real data**.

## Architecture overview

Facts uses a fixed-sequence pipeline, not an autonomous agent. Each stage takes a defined input, returns structured JSON, and writes to a shared `PipelineState`. This keeps behavior deterministic, controls external API cost, and makes failures easier to reason about.

```text
1. Ingest User Company
   URL -> Bright Data scrape -> rawContent
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

## Folder structure

```text
facts/
├── app/                            # Next.js App Router pages and API routes
│   ├── page.tsx                    # Input form and pipeline progress screen
│   ├── results/
│   │   └── page.tsx                # Results dashboard
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts            # Main orchestrating endpoint
│   └── layout.tsx                  # Root layout and metadata
├── lib/                            # Shared backend services and types
│   ├── pipeline/                   # One pure pipeline function per stage
│   ├── clients/                    # Bright Data, Tavily, and LLM wrappers
│   └── types.ts                    # Shared TypeScript schemas
├── components/                     # Dashboard cards, charts, progress, and tables
├── public/
│   └── screenshots/                # Placeholder screenshot assets
├── .env.example                    # Required environment variables
└── README.md                       # Project documentation
```

## Setup instructions

Create a `.env.local` file using `.env.example` as the template:

```bash
TAVILY_API_KEY=
BRIGHT_DATA_API_TOKEN=
BRIGHT_DATA_COLLECTOR_COMPANY_SITE=c_xxxxxxxxxxxxxxxx
BRIGHT_DATA_COLLECTOR_CRUNCHBASE=c_xxxxxxxxxxxxxxxx
BRIGHT_DATA_COLLECTOR_LINKEDIN=c_xxxxxxxxxxxxxxxx
BRIGHT_DATA_COLLECTOR_TOFLER=c_xxxxxxxxxxxxxxxx
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen3.5:9b
```

Local LLM prerequisites:

- Install Ollama and keep it running locally with `ollama serve` on the default port `11434`.
- Use Ollama `0.17.4` or newer. Qwen 3.5 requires the Gated DeltaNet architecture support added in that version.
- Pull the recommended local model with `ollama pull qwen3.5:9b`.
- Use `qwen3.5:27b` for better structured-output reliability if the machine has 16GB+ VRAM, or `qwen3.5:4b` for lighter hardware.

Then install dependencies and run the app:

```bash
npm install
npm run dev
```

The LLM pipeline uses LangChain with a local Ollama/Qwen model. Bright Data requires a valid API token and collector IDs before the full pipeline can scrape real sites.

## Setting Up Bright Data Collectors

Go to [Scraper Studio](https://brightdata.com/cp/scrapers) in the Bright Data control panel, or use the Bright Data CLI through `npx` so nothing needs to be installed globally:

```bash
npx -p @brightdata/cli bdata login
npx -p @brightdata/cli bdata --version
npx -p @brightdata/cli bdata scraper create <sample-url> "<what to extract>"
```

Create four collectors, one per source type:

| Collector | Sample URL | Extraction description |
| --- | --- | --- |
| Company site collector | Any company homepage | Extract company name, tagline, list of products/services, about text, and any team/founders page links |
| Crunchbase collector | A Crunchbase organization page | Extract company name, funding total, funding rounds, investors, founded year |
| LinkedIn collector | A LinkedIn company page | Extract company name, employee count range, industry, headquarters |
| Tofler collector | A Tofler company page | Extract company name, revenue, profit, filing year, CIN |

Review the AI-inferred schema for each collector before confirming. This is the checkpoint for catching misaligned fields before the app sends runtime inputs.

The runtime integration sends each user-provided URL to Bright Data as a default Scraper Studio input object:

```json
[
  { "url": "https://company.com/" }
]
```

Make sure each collector accepts a `url` input field. Bright Data returns a `collection_id` from `/dca/trigger`; the app treats that value as the snapshot ID and polls `/dca/dataset?id=<snapshot_id>` until the JSON array is ready.

Copy each resulting Collector ID (`c_...`) into `.env.local`:

```bash
BRIGHT_DATA_COLLECTOR_COMPANY_SITE=c_...
BRIGHT_DATA_COLLECTOR_CRUNCHBASE=c_...
BRIGHT_DATA_COLLECTOR_LINKEDIN=c_...
BRIGHT_DATA_COLLECTOR_TOFLER=c_...
```

Collector generation typically takes 10-15 minutes per collector. Bright Data's self-healing means these collectors usually do not need to be rebuilt when target page layouts change.

Before running the full pipeline, test the company-site collector:

```bash
npm run test:brightdata
```

This triggers the company-site collector against Kalvium's site by default, logs the raw result, and checks that the output can be serialized as Stage 2 input. Override the test URL with `BRIGHT_DATA_TEST_URL` if needed. The UI uses the same flow: the company URL entered in the form is posted to `/api/analyze`, normalized, and passed to Bright Data as the `url` input.

## Pipeline stage reference

| Stage | Input | Output | External service |
| --- | --- | --- | --- |
| 1. Ingest User Company | Company URL | `rawContent: string` | Bright Data |
| 2. Understand Company | `rawContent` | `CompanyProfile` | LLM |
| 3. Discover Competitors | `searchIntentPhrase` | `{ name, domain? }[]` | LLM + Tavily |
| 4. Rank & Select Competitors | Raw candidates + `CompanyProfile` | `Competitor[]` max 5 | LLM |
| 5. Scrape Competitors | Competitor domains | Raw content per competitor/source | Bright Data |
| 6. Extract Structured Data | Competitor source content | `CompanyProfile[]` | LLM |
| 7. Comparison | User profile + competitor profiles | `ComparisonResult` | LLM |
| 8. Sentiment Optional | Company name + domain | `SentimentResult[]` | Tavily + LLM |

## Screenshots

![Landing page](./public/screenshots/landing.png)
![Pipeline in progress](./public/screenshots/progress.png)
![Results dashboard](./public/screenshots/results.png)
![Comparison charts](./public/screenshots/charts.png)

## Known limitations

Financial and revenue data is often unavailable for smaller private companies, especially when public MCA-style filings or funding databases do not expose usable details. Sentiment analysis is optional and depends on public review source availability; when evidence is sparse, Facts returns an explicit insufficient-data state rather than forcing a score.
