import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const testUrl = process.env.BRIGHT_DATA_TEST_URL ?? "https://www.kalvium.com";
  const {
    canScrapeCompanyPages,
    scrapePage
  } = await import("../lib/clients/brightdata");

  if (!process.env.BRIGHT_DATA_API_TOKEN?.trim()) {
    throw new Error("Set BRIGHT_DATA_API_TOKEN in .env or .env.local before running this test.");
  }

  if (!(await canScrapeCompanyPages())) {
    throw new Error(
      "Set BRIGHT_DATA_WEB_UNLOCKER_ZONE or a real BRIGHT_DATA_COLLECTOR_COMPANY_SITE (gd_… or c_…) before running this test."
    );
  }

  const result = await scrapePage(testUrl);

  if (!result) {
    throw new Error(`No Bright Data result returned for ${testUrl}`);
  }

  console.log("Bright Data company-site scrape result:");
  console.log(result.slice(0, 4000));
  if (result.length > 4000) {
    console.log(`\n… truncated (${result.length} chars total)`);
  }

  if (result.length < 20) {
    throw new Error("Scrape output is too small for Stage 2 company understanding input.");
  }

  console.log("\nStage 2 input check: OK - scrape output can be used as rawContent.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
