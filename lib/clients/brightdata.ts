// lib/clients/brightdata.ts

import { logger } from "./logger";

const API_BASE = "https://api.brightdata.com";
const API_TOKEN = process.env.BRIGHT_DATA_API_TOKEN;

if (!API_TOKEN) {
  logger.stageWarn("BrightData", "BRIGHT_DATA_API_TOKEN is not set - Bright Data calls will fail");
}

interface TriggerInput {
  url: string;
  [key: string]: unknown; // collectors may accept additional input fields
}

interface TriggerResponse {
  collection_id: string;
}

/**
 * Triggers a Bright Data Scraper Studio collector run.
 * Returns a snapshot ID (same value as collection_id) to poll for results.
 *
 * Manual one-time setup required: create each collector in Bright Data
 * Scraper Studio, then paste its c_... Collector ID into .env.local.
 */
export async function triggerCollector(
  collectorId: string,
  inputs: TriggerInput[]
): Promise<string> {
  const url = `${API_BASE}/dca/trigger?collector=${collectorId}&queue_next=1`;
  logger.stageStart("BrightData", "trigger collector", { collectorId, inputCount: inputs.length });

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(inputs)
  });

  if (!response.ok) {
    if (response.status === 422) {
      throw new Error(
        `Bright Data 422: input shape does not match collector ${collectorId}'s input schema`
      );
    }
    throw new Error(`Bright Data trigger failed: ${response.status}`);
  }

  const data: TriggerResponse = await response.json();
  logger.stageComplete("BrightData", "trigger collector", {
    collectorId,
    snapshotId: data.collection_id
  });
  return data.collection_id; // this is the snapshot_id used below
}

/**
 * Polls a Bright Data snapshot until results are ready, or times out.
 * Returns the array of result rows, or an empty array on timeout/no-data.
 */
export async function pollForResults<T = Record<string, unknown>>(
  snapshotId: string,
  { maxWaitMs = 120_000, intervalMs = 5_000 }: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<T[]> {
  const url = `${API_BASE}/dca/dataset?id=${snapshotId}`;
  const deadline = Date.now() + maxWaitMs;
  logger.stageStart("BrightData", "poll snapshot", { snapshotId, maxWaitMs, intervalMs });

  while (Date.now() < deadline) {
    const response = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    });

    if (!response.ok) {
      throw new Error(`Bright Data dataset fetch failed: ${response.status}`);
    }

    const body = await response.json();

    // While building, the API returns a status object, not an array.
    if (Array.isArray(body)) {
      logger.stageComplete("BrightData", "poll snapshot", {
        snapshotId,
        rows: body.length
      });
      return body as T[]; // may be empty if snapshot expired or had no rows
    }

    await sleep(intervalMs);
  }

  // Timed out - return empty rather than throwing, so the pipeline can
  // mark this source as unavailable and continue rather than crash.
  logger.stageWarn("BrightData", "snapshot timed out", { snapshotId, maxWaitMs });
  return [];
}

/**
 * Convenience wrapper: trigger + poll in one call.
 * Use this from pipeline stages unless you need to fan out many
 * triggers before polling any of them.
 */
export async function scrapeUrl<T = Record<string, unknown>>(
  collectorId: string,
  url: string,
  extraInputFields: Record<string, unknown> = {}
): Promise<T | null> {
  try {
    const snapshotId = await triggerCollector(collectorId, [{ url, ...extraInputFields }]);
    const results = await pollForResults<T>(snapshotId);
    return results[0] ?? null;
  } catch (err) {
    logger.stageError("BrightData", "scrapeUrl failed", {
      url,
      collectorId,
      error: err instanceof Error ? err.message : String(err)
    });
    return null; // graceful failure - caller marks this field/source unavailable
  }
}

/**
 * Fan-out helper: trigger scrapes for many URLs against the SAME collector
 * in parallel, then poll each. Use this where you hit the same source type
 * for multiple companies.
 *
 * Bright Data caches dataset snapshots for roughly 7-16 days depending on
 * job type, so this app does not add a separate hackathon-time cache.
 */
export async function scrapeMany<T = Record<string, unknown>>(
  collectorId: string,
  urls: string[]
): Promise<(T | null)[]> {
  logger.stageStart("BrightData", "scrape many", { collectorId, count: urls.length });
  return Promise.all(urls.map((url) => scrapeUrl<T>(collectorId, url)));
}

export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- internal helpers ---

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      // Retry on transient 5xx, fail immediately on 4xx.
      if (response.status >= 500 && attempt < retries) {
        await sleep(2 ** attempt * 1000); // 1s, 2s, 4s
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
