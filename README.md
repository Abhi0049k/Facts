# Facts

Facts is a modern, full-stack competitor intelligence web application built with **Next.js 15 App Router**, **TypeScript**, **TailwindCSS**, **Prisma**, **Supabase PostgreSQL**, **Bright Data**, **Tavily API**, and **LangChain / Ollama**.

Tagline: **AI-powered competitor intelligence, grounded in real data**.

---

## 🏛️ System Architecture

```mermaid
graph TD
    User["User / Business Analyst"] -->|1. Submit Target Company URL| Home["Home Page (/)"]
    Home -->|2. Route with Params| Dashboard["Dashboard (/dashboard)"]
    Dashboard -->|3. SSE Connection| API["API Endpoint (/api/analyze)"]
    
    subgraph ExecutionPipeline ["8-Stage Intelligence Pipeline"]
        API --> S0["Stage 0: DB Lookup"]
        S0 -->|Cached Record| S0Cache["PostgreSQL Cache"]
        S0 -->|Live Scraping| S1["Stage 1: Ingest Site"]
        
        S1 -->|Bright Data Web Unlocker| BD1["Scraped Markdown Content"]
        BD1 --> S2["Stage 2: Understand Company"]
        S2 -->|LLM Classification| S2Profile["Target Company Profile"]
        
        S2Profile --> S3["Stage 3: Discover Competitors"]
        S3 -->|Tavily Search + LLM| S3Candidates["Raw Competitor Candidates"]
        
        S3Candidates --> S4["Stage 4: Rank & Select"]
        S4 -->|LLM Scoring| S4Top5["Top 5 Relevant Competitors"]
        
        S4Top5 --> S5["Stage 5: Scrape Competitors"]
        S5 -->|Bright Data Datasets v3| BD2["Competitor Scrapings"]
        
        BD2 --> S6["Stage 6: Extract Metrics"]
        S6 -->|Tavily Search + LLM| S6Metrics["Metrics (Founded, Funding, Employees, Revenue)"]
        
        S6Metrics --> S7["Stage 7: Market Comparison"]
        S7 -->|LLM Briefing Engine| S7Briefing["Company Intelligence Briefing"]
        
        S7Briefing --> S8["Stage 8: Sentiment Analysis"]
        S8 -->|Tavily Review Search + LLM| S8Sentiment["Public Sentiment Scores"]
    end

    S8Sentiment -->|4. Real-Time SSE Events| Dashboard
    Dashboard -->|5. Tabbed / Grid Briefing| ResultsView["Results & Comparison Matrix"]
```

---

## 📋 Architecture Overview

Facts uses an 8-stage deterministic pipeline. Each stage accepts a typed input, returns validated structured JSON, and updates the execution state stream via Server-Sent Events (SSE):

1. **Stage 0: Lookup (PostgreSQL / Supabase Cache)**: Normalizes domain URL and searches pre-indexed company cache records.
2. **Stage 1: Ingest User Company**: Scrapes company homepage using Bright Data Web Unlocker to generate clean Markdown.
3. **Stage 2: Understand Company**: Analyzes scrape text via LLM to extract company offerings, category, and target audience.
4. **Stage 3: Discover Competitors**: Discovers rival candidates using Tavily Web Search and LLM intent queries.
5. **Stage 4: Rank & Select**: Evaluates candidates to select the top 5 direct market competitors.
6. **Stage 5: Scrape Competitors**: Scrapes candidate homepages and datasets via Bright Data Datasets API v3.
7. **Stage 6: Extract Data & Metrics**: Extracts key company stats (**Founded Year**, **Funding Raised**, **Employees Count**, **Revenue Estimate**).
8. **Stage 7: Market Comparison**: Generates a side-by-side comparison briefing matrix and feature gap analysis.
9. **Stage 8: Sentiment Analysis**: Scans review platforms via Tavily search and performs sentiment scoring (0-100).

---

## 📂 Project Folder Structure

```text
facts/
├── app/                            # Next.js App Router pages and API routes
│   ├── page.tsx                    # Home: company URL input form & hero
│   ├── dashboard/
│   │   └── page.tsx                # Real-time pipeline stage execution & progress
│   ├── results/
│   │   └── page.tsx                # Intelligence report, comparison chart, & briefing
│   ├── api/
│   │   ├── analyze/
│   │   │   └── route.ts            # Server-Sent Events (SSE) streaming pipeline API
│   │   └── cache/
│   │       └── clear/
│   │           └── route.ts        # Pipeline workflow cache invalidation API
│   ├── layout.tsx                  # Root layout, design tokens, and metadata
│   ├── providers.tsx               # Client state providers
│   └── globals.css                 # Global CSS styles and Tailwind utilities
├── components/                     # React UI Components
│   ├── CompanyCard.tsx             # Target & competitor company card with metric pills
│   ├── ComparisonTable.tsx          # Side-by-side comparison matrix with fallback states
│   ├── ComparisonChart.tsx          # Recharts market overlap visualizer
│   ├── MarkdownReport.tsx           # Tabbed & Grid interactive briefing report viewer
│   ├── PipelineProgress.tsx         # 8-circle horizontal stage execution progress bar
│   ├── LimitedDataBanner.tsx        # Live discovery indicator banner
│   ├── SiteHeader.tsx               # Header navigation bar
│   └── StageOutputList.tsx          # Real-time stage payload log list
├── lib/                            # Core pipeline logic and backend clients
│   ├── pipeline/                   # Stage-by-stage pipeline modules
│   │   ├── 0-lookup.ts             # Stage 0: Postgres / Supabase cache lookup
│   │   ├── 1-ingest.ts             # Stage 1: Bright Data homepage scraping
│   │   ├── 2-understand.ts         # Stage 2: Company profile understanding
│   │   ├── 3-discover.ts           # Stage 3: Competitor candidate discovery
│   │   ├── 4-rank.ts               # Stage 4: Top 5 competitor selection
│   │   ├── 5-scrape-competitors.ts # Stage 5: Competitor fan-out scraping
│   │   ├── 6-extract.ts            # Stage 6: Profile & financial metric extraction
│   │   ├── 7-compare.ts            # Stage 7: Market comparison briefing generator
│   │   ├── 8-sentiment.ts          # Stage 8: Public review & sentiment analysis
│   │   └── run.ts                  # Master pipeline execution engine
│   ├── clients/                    # External API integration clients
│   │   ├── brightdata.ts           # Bright Data Web Unlocker & Datasets API v3
│   │   ├── tavily.ts               # Tavily search & company metrics queries
│   │   ├── llm.ts                  # LangChain + Ollama LLM client
│   │   ├── prisma.ts               # Prisma ORM database client
│   │   ├── supabase.ts             # Supabase client singleton
│   │   └── logger.ts               # Structured logger
│   ├── normalize-domain.ts         # Domain normalization helper
│   ├── pipeline-events.ts          # SSE stream event type definitions
│   └── types.ts                    # TypeScript interface & type definitions
├── prisma/                         # Database schema and migration files
│   ├── schema.prisma               # Prisma schema (Company, CompanySource, WorkflowCache)
│   └── migrations/                 # Migration SQL files
├── public/                         # Static web assets and screenshots
│   └── screenshots/                # Application UI screenshots
│       ├── localhost_3000_.png                             # Home page screenshot
│       ├── localhost_3000_dashboard_url=wemakedevs.org.png # Pipeline execution progress screenshot
│       └── localhost_3000_results_url=wemakedevs.org.png   # Intelligence report results screenshot
├── .env.example                    # Environment configuration template
├── package.json                    # Project dependencies and npm scripts
├── tsconfig.json                   # TypeScript configuration
├── tailwind.config.ts              # Tailwind CSS configuration
└── README.md                       # Project documentation
```

---

## 🛠️ Environment Configuration

Create `.env.local` using `.env.example` as a template:

```env
# Search & External Data
TAVILY_API_KEY=your_tavily_api_key

# Bright Data API Integration
BRIGHT_DATA_API_TOKEN=your_brightdata_token
BRIGHT_DATA_WEB_UNLOCKER_ZONE=your_unlocker_zone_name
BRIGHT_DATA_COLLECTOR_LINKEDIN=your_linkedin_dataset_id
BRIGHT_DATA_COLLECTOR_CRUNCHBASE=your_crunchbase_dataset_id

# Ollama Cloud / Local LLM
OLLAMA_API_KEY=your_ollama_api_key
OLLAMA_BASE_URL=https://api.ollama.com
LLM_MODEL=gemma4:cloud

# Database Connection (Supabase / Postgres)
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Start local development server**:
   ```bash
   npm run dev
   ```

---

## 📸 Screenshots

### Home Page
![Home Landing Page](./public/screenshots/localhost_3000_.png)

### Pipeline Execution Progress
![Pipeline Progress Screen](./public/screenshots/localhost_3000_dashboard_url=wemakedevs.org.png)

### Intelligence Report & Comparison Matrix
![Intelligence Results Page](./public/screenshots/localhost_3000_results_url=wemakedevs.org.png)

---

## ⚙️ Key Technical Features

- **8-Circle Interactive Pipeline**: Animated stage progress with real-time SSE stream events.
- **Side-by-Side Market Matrix**: Displays direct comparisons for Founded Year, Funding Raised, Employees, Revenue, and Offerings.
- **Tabbed & Grid Briefing Viewer**: Interactive company switcher for clutter-free analysis of 5+ companies.
- **Graceful Data Fallbacks**: Handles missing company stats with `"N/A"` indicators without breaking layout bounds.
- **Domain Normalization & Deduplication**: Prevents duplicate database entries across CSV imports and live lookups.