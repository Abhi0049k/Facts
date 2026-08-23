-- CreateTable
CREATE TABLE "WorkflowCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "companyUrl" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "includeSentiment" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "completedStages" INTEGER[] NOT NULL,
    "failedStage" TEXT,
    "error" TEXT,
    "databaseMatch" BOOLEAN,
    "stagePayloads" JSONB NOT NULL,
    "state" JSONB,
    "lookup" JSONB,
    "rawContent" TEXT,
    "understood" JSONB,
    "competitorScrapes" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowCache_cacheKey_key" ON "WorkflowCache"("cacheKey");

-- CreateIndex
CREATE INDEX "WorkflowCache_cacheKey_expiresAt_idx" ON "WorkflowCache"("cacheKey", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkflowCache_normalizedDomain_idx" ON "WorkflowCache"("normalizedDomain");
