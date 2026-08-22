import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";
import { normalizeDomain } from "../lib/normalize-domain";

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

type CsvRow = Record<string, string>;

const prisma = new PrismaClient();

function loadEnvFile(name: string, overwrite: boolean) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (overwrite || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-companies.ts data/your-batch.csv");
    process.exit(1);
  }

  const csv = readFileSync(resolve(process.cwd(), filePath), "utf8");
  const parsed = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parsed.errors.length) {
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 5));
  }

  let processed = 0;
  let created = 0;
  let updated = 0;
  let sourcesInserted = 0;
  let skipped = 0;

  for (const row of parsed.data) {
    processed += 1;
    const companyName = (row.company_name ?? "").trim();
    const domain = normalizeDomain(row.primary_domain ?? "");
    if (!domain) {
      skipped += 1;
      console.warn(`Skip row ${processed}: empty primary_domain (${companyName || "unnamed"})`);
      continue;
    }

    const existing = await prisma.company.findUnique({ where: { primaryDomain: domain } });
    const company = await prisma.company.upsert({
      where: { primaryDomain: domain },
      create: { companyName: companyName || domain, primaryDomain: domain },
      update: { companyName: companyName || domain }
    });
    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    const notes = (row.notes ?? "").trim() || null;
    const sourcePairs: Array<{ urlKey: string; typeKey: string; category: "info" | "sentiment" }> = [
      { urlKey: "info_url_1", typeKey: "info_url_1_source_type", category: "info" },
      { urlKey: "info_url_2", typeKey: "info_url_2_source_type", category: "info" },
      { urlKey: "sentiment_url_1", typeKey: "sentiment_url_1_source_type", category: "sentiment" },
      { urlKey: "sentiment_url_2", typeKey: "sentiment_url_2_source_type", category: "sentiment" }
    ];

    for (const pair of sourcePairs) {
      const url = (row[pair.urlKey] ?? "").trim();
      if (!url) {
        continue;
      }
      const sourceType = (row[pair.typeKey] ?? "other").trim() || "other";
      const before = await prisma.companySource.findUnique({
        where: { companyId_url: { companyId: company.id, url } }
      });
      await prisma.companySource.upsert({
        where: { companyId_url: { companyId: company.id, url } },
        create: {
          companyId: company.id,
          url,
          sourceCategory: pair.category,
          sourceType,
          notes
        },
        update: {
          sourceCategory: pair.category,
          sourceType,
          notes
        }
      });
      if (!before) {
        sourcesInserted += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        file: filePath,
        processed,
        companiesCreated: created,
        companiesUpdated: updated,
        sourcesInserted,
        rowsSkipped: skipped
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
