-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "primaryDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceCategory" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CompanySource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_primaryDomain_key" ON "Company"("primaryDomain");

-- CreateIndex
CREATE INDEX "CompanySource_companyId_idx" ON "CompanySource"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySource_companyId_url_key" ON "CompanySource"("companyId", "url");

-- AddForeignKey
ALTER TABLE "CompanySource" ADD CONSTRAINT "CompanySource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

