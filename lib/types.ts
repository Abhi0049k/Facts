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

export interface AnalyzeRequest {
  companyUrl: string;
  includeSentiment?: boolean;
}

export interface AnalyzeResponse {
  runId?: string;
  state: PipelineState;
  completedStages: number[];
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
