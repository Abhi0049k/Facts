import { logger } from "./logger";

const API_BASE = "https://api.brightdata.com";
const DEFAULT_POLL_MS = 180_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const UNLOCKER_TIMEOUT_MS = 60_000;
const V3_SCRAPE_TIMEOUT_MS = 90_000;
const MAX_MARKDOWN_CHARS = 50_000;
const V3_BATCH_LIMIT = 20;

type JsonRecord = Record<string, unknown>;

interface TriggerInput {
  url: string;
  [key: string]: unknown;
}

function apiToken(): string {
  const token = process.env.BRIGHT_DATA_API_TOKEN?.trim();
  if (!token) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }
  return token;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${apiToken()}`,
    "Content-Type": "application/json"
  };
}

export function isUsableSourceId(id: string | undefined | null): id is string {
  if (!id) {
    return false;
  }
  const trimmed = id.trim();
  if (!trimmed || trimmed.includes("xxxxxxxx")) {
    return false;
  }
  return trimmed.startsWith("gd_") || trimmed.startsWith("c_");
}

export function getWebUnlockerZone(): string | undefined {
  const zone = process.env.BRIGHT_DATA_WEB_UNLOCKER_ZONE?.trim();
  if (!zone || zone.includes("xxxx")) {
    return undefined;
  }
  return zone;
}

let cachedUnlockerZone: string | undefined | null = null;

async function resolveUnlockerZone(): Promise<string | undefined> {
  if (cachedUnlockerZone !== null) {
    return cachedUnlockerZone ?? undefined;
  }

  const configured = getWebUnlockerZone();
  if (configured) {
    cachedUnlockerZone = configured;
    return configured;
  }

  cachedUnlockerZone = (await findActiveUnlockerZone()) ?? undefined;
  return cachedUnlockerZone ?? undefined;
}

async function findActiveUnlockerZone(): Promise<string | undefined> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/zone/get_active_zones`, {
      headers: { Authorization: `Bearer ${apiToken()}` }
    });
    if (!response.ok) {
      logger.stageWarn("BrightData", "could not list zones", { status: response.status });
      return undefined;
    }
    const zones = (await response.json()) as { name?: string; type?: string }[];
    const unlocker = zones.find((zone) => zone.type === "unblocker" && zone.name);
    if (unlocker?.name) {
      logger.debug("BrightData", "auto-detected Web Unlocker zone", { zone: unlocker.name });
      return unlocker.name;
    }
  } catch (err) {
    logger.stageWarn("BrightData", "zone auto-detect failed", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  return undefined;
}

export async function canScrapeCompanyPages(): Promise<boolean> {
  return isUsableSourceId(process.env.BRIGHT_DATA_COLLECTOR_COMPANY_SITE) || Boolean(await resolveUnlockerZone());
}

/**
 * Homepage / arbitrary-site scrape. Prefers a configured dataset or collector,
 * otherwise Web Unlocker markdown.
 */
export async function scrapePage(url: string): Promise<string | null> {
  const sourceId = process.env.BRIGHT_DATA_COLLECTOR_COMPANY_SITE;
  if (isUsableSourceId(sourceId)) {
    const row = await scrapeUrl(sourceId, url);
    return serializeResult(row);
  }

  const zone = await resolveUnlockerZone();
  if (zone) {
    return scrapeWithUnlocker(url, zone);
  }

  return null;
}

export async function scrapeWithUnlocker(url: string, zone?: string): Promise<string | null> {
  const resolvedZone = zone ?? (await resolveUnlockerZone());
  if (!resolvedZone) {
    return null;
  }

  logger.stageStart("BrightData", "web unlocker", { url, zone: resolvedZone });

  try {
    const response = await fetchWithRetry(
      `${API_BASE}/request`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          zone: resolvedZone,
          url,
          format: "raw",
          data_format: "markdown"
        })
      },
      { timeoutMs: UNLOCKER_TIMEOUT_MS }
    );

    if (response.status === 400) {
      const detail = await response.text();
      if (detail.includes("not found")) {
        const fallback = await findActiveUnlockerZone();
        if (fallback && fallback !== resolvedZone) {
          logger.stageWarn("BrightData", "configured unlocker zone missing, using active zone", {
            configured: resolvedZone,
            zone: fallback
          });
          cachedUnlockerZone = fallback;
          return scrapeWithUnlocker(url, fallback);
        }
      }
      throw new Error(`Web Unlocker failed: 400 — ${detail.slice(0, 300)}`);
    }

    if (!response.ok) {
      throw new Error(await describeHttpError("Web Unlocker", response));
    }

    const text = (await response.text()).trim();
    if (!text) {
      logger.stageWarn("BrightData", "web unlocker returned empty body", { url });
      return null;
    }

    const clipped = text.length > MAX_MARKDOWN_CHARS ? `${text.slice(0, MAX_MARKDOWN_CHARS)}\n…` : text;
    logger.stageComplete("BrightData", "web unlocker", { url, chars: clipped.length });
    return clipped;
  } catch (err) {
    logger.stageError("BrightData", "web unlocker failed", {
      url,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

/**
 * Scrapes using Bright Data Datasets API v3.
 * POST /datasets/v3/scrape — on HTTP 202, poll progress then download the snapshot.
 */
export async function scrapeDatasetV3<T = JsonRecord>(
  datasetId: string,
  inputs: TriggerInput[]
): Promise<T[]> {
  if (inputs.length === 0) {
    return [];
  }

  const batches: TriggerInput[][] = [];
  for (let i = 0; i < inputs.length; i += V3_BATCH_LIMIT) {
    batches.push(inputs.slice(i, i + V3_BATCH_LIMIT));
  }

  const rows: T[] = [];
  for (const batch of batches) {
    rows.push(...(await scrapeDatasetV3Batch<T>(datasetId, batch)));
  }
  return rows;
}

async function scrapeDatasetV3Batch<T>(datasetId: string, inputs: TriggerInput[]): Promise<T[]> {
  const url = `${API_BASE}/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&format=json&include_errors=true`;
  logger.stageStart("BrightData", "dataset v3 scrape", { datasetId, inputCount: inputs.length });

  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ input: inputs })
    },
    { timeoutMs: V3_SCRAPE_TIMEOUT_MS }
  );

  if (response.status === 202) {
    const snapshotId = await readSnapshotId(response);
    logger.debug("BrightData", "v3 scrape returned 202, polling snapshot", { datasetId, snapshotId });
    return pollV3Snapshot<T>(snapshotId);
  }

  if (!response.ok) {
    throw new Error(await describeHttpError("Bright Data v3 scrape", response, datasetId));
  }

  const rows = filterErrorRows(await parseDatasetBody<T>(response));
  logger.stageComplete("BrightData", "dataset v3 scrape", { datasetId, rows: rows.length });
  return rows;
}

async function pollV3Snapshot<T>(snapshotId: string, maxWaitMs = DEFAULT_POLL_MS): Promise<T[]> {
  const deadline = Date.now() + maxWaitMs;
  logger.stageStart("BrightData", "poll v3 snapshot", { snapshotId, maxWaitMs });

  while (Date.now() < deadline) {
    const progress = await fetchWithRetry(`${API_BASE}/datasets/v3/progress/${encodeURIComponent(snapshotId)}`, {
      headers: { Authorization: `Bearer ${apiToken()}` }
    });

    if (!progress.ok) {
      throw new Error(await describeHttpError("Bright Data snapshot progress", progress));
    }

    const body = (await progress.json()) as { status?: string };
    if (body.status === "failed" || body.status === "canceled") {
      throw new Error(`Bright Data snapshot ${snapshotId} ${body.status}`);
    }

    if (body.status === "ready") {
      const download = await fetchWithRetry(
        `${API_BASE}/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
        { headers: { Authorization: `Bearer ${apiToken()}` } }
      );
      if (!download.ok) {
        throw new Error(await describeHttpError("Bright Data snapshot download", download));
      }
      const rows = filterErrorRows(await parseDatasetBody<T>(download));
      logger.stageComplete("BrightData", "poll v3 snapshot", { snapshotId, rows: rows.length });
      return rows;
    }

    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  logger.stageWarn("BrightData", "v3 snapshot timed out", { snapshotId, maxWaitMs });
  return [];
}

export async function triggerCollector(collectorId: string, inputs: TriggerInput[]): Promise<string> {
  const url = `${API_BASE}/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`;
  logger.stageStart("BrightData", "trigger collector", { collectorId, inputCount: inputs.length });

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(inputs)
  });

  if (!response.ok) {
    throw new Error(await describeHttpError("Bright Data collector trigger", response, collectorId));
  }

  const data = (await response.json()) as { collection_id?: string; snapshot_id?: string };
  const snapshotId = data.collection_id ?? data.snapshot_id;
  if (!snapshotId) {
    throw new Error(`Bright Data trigger for ${collectorId} did not return a snapshot id`);
  }

  logger.stageComplete("BrightData", "trigger collector", { collectorId, snapshotId });
  return snapshotId;
}

export async function pollForResults<T = JsonRecord>(
  snapshotId: string,
  { maxWaitMs = DEFAULT_POLL_MS, intervalMs = DEFAULT_POLL_INTERVAL_MS } = {}
): Promise<T[]> {
  const deadline = Date.now() + maxWaitMs;
  logger.stageStart("BrightData", "poll collector snapshot", { snapshotId, maxWaitMs });

  while (Date.now() < deadline) {
    const response = await fetchWithRetry(`${API_BASE}/dca/dataset?id=${encodeURIComponent(snapshotId)}`, {
      headers: { Authorization: `Bearer ${apiToken()}` }
    });

    if (!response.ok) {
      throw new Error(await describeHttpError("Bright Data dataset fetch", response));
    }

    const body: unknown = await response.json();
    if (Array.isArray(body)) {
      logger.stageComplete("BrightData", "poll collector snapshot", { snapshotId, rows: body.length });
      return body as T[];
    }

    await sleep(intervalMs);
  }

  logger.stageWarn("BrightData", "collector snapshot timed out", { snapshotId, maxWaitMs });
  return [];
}

/**
 * One URL against a dataset (`gd_`) or Scraper Studio collector (`c_`).
 * Does not try both APIs.
 */
export async function scrapeUrl<T = JsonRecord>(
  sourceId: string,
  url: string,
  extraInputFields: Record<string, unknown> = {}
): Promise<T | null> {
  const results = await scrapeMany<T>(sourceId, [url], extraInputFields);
  return results[0] ?? null;
}

/**
 * Fan-out against one source. Dataset IDs batch in a single v3 request (max 20).
 */
export async function scrapeMany<T = JsonRecord>(
  sourceId: string,
  urls: string[],
  extraInputFields: Record<string, unknown> = {}
): Promise<(T | null)[]> {
  const uniqueUrls = urls.filter(Boolean);
  if (uniqueUrls.length === 0) {
    return [];
  }

  logger.stageStart("BrightData", "scrape many", { sourceId, count: uniqueUrls.length });

  try {
    const inputs = uniqueUrls.map((url) => ({ url, ...extraInputFields }));
    let rows: T[] = [];

    if (sourceId.startsWith("gd_")) {
      rows = await scrapeDatasetV3<T>(sourceId, inputs);
    } else if (sourceId.startsWith("c_")) {
      const snapshotId = await triggerCollector(sourceId, inputs);
      rows = await pollForResults<T>(snapshotId);
    } else {
      throw new Error(`Unsupported Bright Data source id ${sourceId} (expected gd_… dataset or c_… collector)`);
    }

    if (rows.length === uniqueUrls.length && !rows.some((row) => rowHasUrl(row))) {
      return rows;
    }

    const byUrl = indexRowsByUrl(rows);
    return uniqueUrls.map((url) => byUrl.get(urlKey(url)) ?? matchFirstUnindexed(byUrl, url) ?? null);
  } catch (err) {
    logger.stageError("BrightData", "scrape many failed", {
      sourceId,
      error: err instanceof Error ? err.message : String(err)
    });
    return uniqueUrls.map(() => null);
  }
}

export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function serializeResult(result: unknown): string | null {
  if (result == null) {
    return null;
  }
  if (typeof result === "string") {
    return result.trim() ? result : null;
  }
  const text = JSON.stringify(result, null, 2);
  return text === "{}" || text === "null" ? null : text;
}

export async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function urlKey(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.replace(/\/+$/, "").toLowerCase();
  }
}

function rowHasUrl(row: unknown): boolean {
  return Boolean(row && typeof row === "object" && typeof (row as JsonRecord).url === "string");
}

function indexRowsByUrl<T>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const url = (row as JsonRecord).url;
    if (typeof url === "string" && url) {
      map.set(urlKey(url), row);
    }
  }
  return map;
}

function matchFirstUnindexed<T>(byUrl: Map<string, T>, url: string): T | undefined {
  if (byUrl.size === 1 && !byUrl.has(urlKey(url))) {
    return [...byUrl.values()][0];
  }
  return undefined;
}

function filterErrorRows<T>(rows: T[]): T[] {
  return rows.filter((row) => {
    if (!row || typeof row !== "object") {
      return true;
    }
    const error = (row as JsonRecord).error;
    if (typeof error === "string" && error.length > 0) {
      logger.stageWarn("BrightData", "dataset row error", { error, url: (row as JsonRecord).url });
      return false;
    }
    return true;
  });
}

async function parseDatasetBody<T>(response: Response): Promise<T[]> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
    if (parsed && typeof parsed === "object" && "snapshot_id" in parsed && !("url" in parsed)) {
      return pollV3Snapshot<T>(String((parsed as { snapshot_id: string }).snapshot_id));
    }
    return [parsed as T];
  } catch {
    const lines = rawText.split("\n").filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as T);
  }
}

async function readSnapshotId(response: Response): Promise<string> {
  const body = (await response.json()) as { snapshot_id?: string };
  if (!body.snapshot_id) {
    throw new Error("Bright Data v3 scrape returned 202 without snapshot_id");
  }
  return body.snapshot_id;
}

async function describeHttpError(label: string, response: Response, sourceId?: string): Promise<string> {
  const detail = (await response.text()).slice(0, 300);
  if (response.status === 401) {
    return `${label} 401: API token is missing, invalid, or revoked`;
  }
  if (response.status === 404) {
    return sourceId
      ? `${label} 404: ${sourceId} was not found or is not available to this account`
      : `${label} 404`;
  }
  if (response.status === 422) {
    return `${label} 422: input shape rejected${sourceId ? ` for ${sourceId}` : ""}${detail ? ` — ${detail}` : ""}`;
  }
  return `${label} failed: ${response.status}${detail ? ` — ${detail}` : ""}`;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, timeoutMs = 30_000 }: { retries?: number; timeoutMs?: number } = {}
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status >= 500 && attempt < retries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      await sleep(2 ** attempt * 1000);
    }
  }
  throw new Error("fetchWithRetry: exhausted retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
