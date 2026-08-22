import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";
import { normalizeDomain } from "../lib/normalize-domain";

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

type CsvRow = Record<string, string>;

type MappedSource = {
  url: string;
  sourceCategory: "info" | "sentiment";
  sourceType: string;
};

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

function cell(row: CsvRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = (row[key] ?? "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function isGoogleSearch(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("google.com/search") || lower.includes("google.co.in/search");
}

function isUsableSourceUrl(url: string): boolean {
  if (!url || isGoogleSearch(url)) {
    return false;
  }
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com/") || lower.includes("youtu.be/")) {
    return false;
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function inferSourceType(url: string, fallback: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("wikipedia.org")) return "wikipedia";
  if (lower.includes("glassdoor.")) return "glassdoor";
  if (lower.includes("ambitionbox.")) return "ambitionbox";
  if (lower.includes("crunchbase.")) return "crunchbase";
  if (lower.includes("tracxn.")) return "tracxn";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("trustpilot.")) return "trustpilot";
  if (lower.includes("mouthshut.")) return "mouthshut";
  if (lower.includes("reddit.com")) return "reddit";
  if (lower.includes("g2.com")) return "g2";
  if (lower.includes("capterra.")) return "capterra";
  return fallback || "other";
}

function pushSource(sources: MappedSource[], url: string, category: "info" | "sentiment", fallbackType: string) {
  if (!isUsableSourceUrl(url)) {
    return;
  }
  if (sources.some((source) => source.url === url)) {
    return;
  }
  sources.push({
    url,
    sourceCategory: category,
    sourceType: inferSourceType(url, fallbackType)
  });
}

function mapRow(row: CsvRow): { companyName: string; domain: string; notes: string | null; sources: MappedSource[] } {
  const companyName = cell(row, "company_name", "organisation_name", "organization", "business_name");
  const domain = normalizeDomain(cell(row, "primary_domain", "official_domain", "official_website_url", "business_domain"));
  const notes = cell(row, "notes") || null;
  const sources: MappedSource[] = [];

  pushSource(sources, cell(row, "info_url_1"), "info", cell(row, "info_url_1_source_type") || "other");
  pushSource(sources, cell(row, "info_url_2"), "info", cell(row, "info_url_2_source_type") || "other");
  pushSource(sources, cell(row, "sentiment_url_1"), "sentiment", cell(row, "sentiment_url_1_source_type") || "other");
  pushSource(sources, cell(row, "sentiment_url_2"), "sentiment", cell(row, "sentiment_url_2_source_type") || "other");

  pushSource(sources, cell(row, "information_url", "business_info_url"), "info", "own_about_page");
  pushSource(sources, cell(row, "founder_relationship_evidence_url", "relationship_evidence_url"), "info", cell(row, "evidence_source_type") || "other");

  return { companyName, domain, notes, sources };
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
    const mapped = mapRow(row);
    if (!mapped.domain) {
      skipped += 1;
      console.warn(`Skip row ${processed}: empty primary domain (${mapped.companyName || "unnamed"})`);
      continue;
    }

    const existing = await prisma.company.findUnique({ where: { primaryDomain: mapped.domain } });
    const company = await prisma.company.upsert({
      where: { primaryDomain: mapped.domain },
      create: { companyName: mapped.companyName || mapped.domain, primaryDomain: mapped.domain },
      update: existing ? {} : { companyName: mapped.companyName || mapped.domain }
    });
    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    for (const source of mapped.sources) {
      const before = await prisma.companySource.findUnique({
        where: { companyId_url: { companyId: company.id, url: source.url } }
      });
      await prisma.companySource.upsert({
        where: { companyId_url: { companyId: company.id, url: source.url } },
        create: {
          companyId: company.id,
          url: source.url,
          sourceCategory: source.sourceCategory,
          sourceType: source.sourceType,
          notes: mapped.notes
        },
        update: {
          sourceCategory: source.sourceCategory,
          sourceType: source.sourceType,
          notes: mapped.notes
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
