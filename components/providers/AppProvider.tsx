"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type PageName = "home" | "processing" | "report";

interface AppContextValue {
  currentPage: PageName;
  navigate: (page: PageName) => void;
  companyDomain: string;
  setCompanyDomain: (domain: string) => void;
  includeSentiment: boolean;
  setIncludeSentiment: (include: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageName>("home");
  const [companyDomain, setCompanyDomain] = useState("");
  const [includeSentiment, setIncludeSentiment] = useState(false);

  const navigate = useCallback((page: PageName) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentPage,
        navigate,
        companyDomain,
        setCompanyDomain,
        includeSentiment,
        setIncludeSentiment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}