export interface CompanyProfile {
  name: string;
  domain: string;
  category: string;
  offeringsSummary: string;
  searchIntentPhrase?: string;
  founders?: string[];
  stats: {
    fundingTotal?: string;
    employeeCount?: string;
    revenueEstimate?: string;
    foundedYear?: number;
    dataAvailability: {
      funding: boolean;
      revenue: boolean;
      employeeCount: boolean;
    };
  };
}

export interface ComparisonResult {
  userCompany: CompanyProfile;
  competitors: CompanyProfile[];
  serviceOverlap: { service: string; companies: string[] }[];
  gaps: { company: string; missingRelativeToUser: string[] }[];
  markdown?: string;
}

export interface SentimentResult {
  companyName: string;
  sentimentScore?: number;
  summary: string;
  sourcesUsed: string[];
  dataAvailable: boolean;
}

export interface PipelineState {
  userCompany: CompanyProfile | null;
  competitorsRaw: { name: string; domain?: string }[] | null;
  competitorsRanked: { name: string; domain: string }[] | null;
  competitorProfiles: CompanyProfile[];
  comparison: ComparisonResult | null;
  sentiment: SentimentResult[] | null;
}

export interface StageOutputRecord {
  stage: number;
  title: string;
  payload?: unknown;
}

export interface ScrapedSourceContent {
  website: string | null;
  crunchbase: string | null;
  tracxn: string | null;
  linkedin: string | null;
  tofler: string | null;
}

export interface CompetitorScrapeResult {
  competitor: { name: string; domain: string };
  sources: ScrapedSourceContent;
}

export interface PipelineCheckpoint {
  companyUrl: string;
  normalizedDomain: string;
  includeSentiment: boolean;
  completedStages: number[];
  stagePayloads: StageOutputRecord[];
  state: PipelineState;
  databaseMatch?: boolean;
  lookup?: unknown;
  rawContent?: string;
  understood?: unknown;
  competitorScrapes?: CompetitorScrapeResult[];
}

export interface AnalyzeRequest {
  companyUrl: string;
  includeSentiment?: boolean;
}

export type SiteKind = "company" | "personal_profile" | "not_a_company";

export interface AnalyzeResponse {
  runId?: string;
  state: PipelineState;
  completedStages: number[];
  halted?: boolean;
  haltMessage?: string;
  databaseMatch?: boolean;
}

export interface AnalyzeErrorResponse {
  runId?: string;
  error: string;
  failedStage?: string;
  completedStages?: number[];
}

export class PipelineStageError extends Error {
  constructor(
    public stage: string,
    message: string
  ) {
    super(message);
    this.name = "PipelineStageError";
  }
}
