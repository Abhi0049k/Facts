"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type StageStatus = "pending" | "active" | "complete" | "error";

interface Stage {
  id: string;
  label: string;
  description?: string;
  status: StageStatus;
  result?: string;
  chips?: string[];
  duration?: number;
  hidden?: boolean;
}

interface PipelineContextValue {
  stages: Stage[];
  currentStageIndex: number;
  isRunning: boolean;
  summaryVisible: boolean;
  summaryData: {
    closestMatch: string;
    furthestMatch: string;
    sentimentCoverage: string;
  } | null;
  startPipeline: (includeSentiment: boolean) => void;
  resetPipeline: () => void;
  updateStage: (stageId: string, status: StageStatus, result?: string, chips?: string[]) => void;
  setSummaryVisible: (visible: boolean) => void;
  setSummaryData: (data: PipelineContextValue["summaryData"]) => void;
}

const initialStages: Stage[] = [
  { id: "lookup", label: "Looking up company in the database", description: "Checking database for verified sources", status: "pending" },
  { id: "ingest", label: "Scraping company profile", description: "Fetching live company page content", status: "pending" },
  { id: "discover", label: "Discovering competitors", description: "Searching for relevant competitors", status: "pending" },
  { id: "rank", label: "Ranking and selecting top 3", description: "Filtering by relevance and market overlap", status: "pending" },
  { id: "scrape", label: "Scraping competitor sources", description: "Fetching competitor pages, Crunchbase, LinkedIn, Tracxn", status: "pending" },
  { id: "extract", label: "Extracting structured profiles", description: "Parsing founders, funding, headcount, offerings", status: "pending" },
  { id: "sentiment", label: "Scanning sentiment sources", description: "Searching reviews and public discussions", status: "pending", hidden: true },
  { id: "compare", label: "Building comparison", description: "Generating comparison matrix across metrics", status: "pending" },
];

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children, includeSentiment = false }: { children: ReactNode; includeSentiment?: boolean }) {
  const [stages, setStages] = useState<Stage[]>(() => 
    initialStages.map(s => ({ ...s, hidden: s.id === "sentiment" ? !includeSentiment : false }))
  );
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryData, setSummaryData] = useState<PipelineContextValue["summaryData"]>(null);

  const startPipeline = useCallback((sentimentOn: boolean) => {
    setStages(initialStages.map(s => ({ 
      ...s, 
      status: "pending", 
      result: undefined, 
      chips: undefined,
      hidden: s.id === "sentiment" ? !sentimentOn : false 
    })));
    setCurrentStageIndex(0);
    setIsRunning(true);
    setSummaryVisible(false);
    setSummaryData(null);

    const order = sentimentOn
      ? ["lookup", "ingest", "discover", "rank", "scrape", "extract", "sentiment", "compare"]
      : ["lookup", "ingest", "discover", "rank", "scrape", "extract", "compare"];

    let delay = 250;
    order.forEach((stageId, index) => {
      setTimeout(() => {
        setStages(prev => prev.map(s => 
          s.id === stageId ? { ...s, status: "active" } : s
        ));
      }, delay);
      delay += 550;
      setTimeout(() => {
        setStages(prev => prev.map(s => 
          s.id === stageId ? { ...s, status: "complete" } : s
        ));
        setCurrentStageIndex(index + 1);
      }, delay);
      delay += 150;
    });

    setTimeout(() => {
      setSummaryVisible(true);
      setIsRunning(false);
      setSummaryData({
        closestMatch: "Newton School",
        furthestMatch: "Pesto Tech",
        sentimentCoverage: sentimentOn ? "2/3 competitors scored" : "Not run",
      });
    }, delay + 200);
  }, []);

  const resetPipeline = useCallback(() => {
    setStages(initialStages);
    setCurrentStageIndex(0);
    setIsRunning(false);
    setSummaryVisible(false);
    setSummaryData(null);
  }, []);

  const updateStage = useCallback((stageId: string, status: StageStatus, result?: string, chips?: string[]) => {
    setStages(prev => prev.map(s => 
      s.id === stageId ? { ...s, status, result, chips } : s
    ));
  }, []);

  const setSummaryVisibleCb = useCallback((visible: boolean) => {
    setSummaryVisible(visible);
  }, []);

  const setSummaryDataCb = useCallback((data: PipelineContextValue["summaryData"]) => {
    setSummaryData(data);
  }, []);

  return (
    <PipelineContext.Provider
      value={{
        stages,
        currentStageIndex,
        isRunning,
        summaryVisible,
        summaryData,
        startPipeline,
        resetPipeline,
        updateStage,
        setSummaryVisible: setSummaryVisibleCb,
        setSummaryData: setSummaryDataCb,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipeline must be used within a PipelineProvider");
  }
  return context;
}