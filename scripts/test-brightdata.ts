import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const collectorId = process.env.BRIGHT_DATA_COLLECTOR_COMPANY_SITE;
  const testUrl = process.env.BRIGHT_DATA_TEST_URL ?? "https://www.kalvium.com";

  if (!collectorId || collectorId === "c_xxxxxxxxxxxxxxxx") {
    throw new Error(
      "Set BRIGHT_DATA_COLLECTOR_COMPANY_SITE in .env.local before running this test."
    );
  }

  const { scrapeUrl } = await import("../lib/clients/brightdata");
  const result = await scrapeUrl<Record<string, unknown>>(collectorId, testUrl);

  if (!result) {
    throw new Error(`No Bright Data result returned for ${testUrl}`);
  }

  console.log("Bright Data company-site collector result:");
  console.dir(result, { depth: null });

  const serialized = JSON.stringify(result, null, 2);
  if (!serialized || serialized.length < 20) {
    throw new Error("Collector output is too small for Stage 2 company understanding input.");
  }

  console.log("\nStage 2 input check: OK - collector output can be serialized as rawContent.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
