import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { normalizeDomain } from "../lib/normalize-domain";

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const prisma = new PrismaClient();

const SHEET_NAME = "Batch 1";

type LinkedInRow = {
  Organization?: string;
  Type?: string;
  Origin?: string;
  "Official Website URL"?: string;
  "Info / What They Do URL"?: string;
  "Employee Sentiment URL (Glassdoor)"?: string;
  "Employee Sentiment URL (AmbitionBox)"?: string;
  "Customer / Public Sentiment Search URL"?: string;
  "Indian-founder status"?: string;
  "LinkedIn discovery"?: string;
  Batch?: string;
};

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

function cell(value: unknown): string {
  return String(value ?? "").trim();
}

function isUsableSourceUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  const lower = url.toLowerCase();
  if (lower.includes("google.com/search") || lower.includes("google.co.in/search")) {
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
  return fallback;
}

async function upsertSource(input: {
  companyId: string;
  url: string;
  sourceCategory: "info" | "sentiment";
  sourceType: string;
  notes: string | null;
}): Promise<boolean> {
  const before = await prisma.companySource.findUnique({
    where: { companyId_url: { companyId: input.companyId, url: input.url } }
  });
  await prisma.companySource.upsert({
    where: { companyId_url: { companyId: input.companyId, url: input.url } },
    create: input,
    update: {
      sourceCategory: input.sourceCategory,
      sourceType: input.sourceType,
      notes: input.notes
    }
  });
  return !before;
}

async function main() {
  const filePath = process.argv[2] ?? "data/Indian_Organizations_LinkedIn_Batch_1.xlsx";
  const abs = resolve(process.cwd(), filePath);
  const workbook = XLSX.readFile(abs);
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found. Available: ${workbook.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json<LinkedInRow>(sheet, { defval: "" });

  let processed = 0;
  let created = 0;
  let updated = 0;
  let sourcesInserted = 0;
  let skipped = 0;

  for (const row of rows) {
    processed += 1;
    const companyName = cell(row.Organization);
    const domain = normalizeDomain(cell(row["Official Website URL"]));
    if (!domain) {
      skipped += 1;
      console.warn(`Skip row ${processed}: empty official website (${companyName || "unnamed"})`);
      continue;
    }

    const notesParts = [
      cell(row.Type) && `type=${cell(row.Type)}`,
      cell(row.Origin) && `origin=${cell(row.Origin)}`,
      cell(row.Batch) && `batch=${cell(row.Batch)}`,
      cell(row["Indian-founder status"])
    ].filter(Boolean);
    const notes = notesParts.join("; ") || null;

    const existing = await prisma.company.findUnique({ where: { primaryDomain: domain } });
    const company = await prisma.company.upsert({
      where: { primaryDomain: domain },
      create: { companyName: companyName || domain, primaryDomain: domain },
      update: existing ? {} : { companyName: companyName || domain }
    });
    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    const sources: Array<{ url: string; category: "info" | "sentiment"; fallbackType: string }> = [
      { url: cell(row["Info / What They Do URL"]), category: "info", fallbackType: "other" },
      { url: cell(row["Employee Sentiment URL (Glassdoor)"]), category: "sentiment", fallbackType: "glassdoor" },
      { url: cell(row["Employee Sentiment URL (AmbitionBox)"]), category: "sentiment", fallbackType: "ambitionbox" }
    ];

    const seen = new Set<string>();
    for (const source of sources) {
      if (!isUsableSourceUrl(source.url) || seen.has(source.url)) {
        continue;
      }
      seen.add(source.url);
      const inserted = await upsertSource({
        companyId: company.id,
        url: source.url,
        sourceCategory: source.category,
        sourceType: inferSourceType(source.url, source.fallbackType),
        notes
      });
      if (inserted) {
        sourcesInserted += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        file: filePath,
        sheet: SHEET_NAME,
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
