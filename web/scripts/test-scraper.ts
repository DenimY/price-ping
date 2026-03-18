import { normalizeInputUrl } from "../lib/mall";
import { runScraperTest } from "../lib/scrapers/index";

type CliOptions = {
  url: string | null;
  printHtml: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  let url: string | null = null;
  let printHtml = false;

  for (const arg of args) {
    if (arg === "--html") {
      printHtml = true;
      continue;
    }

    if (!url) {
      url = arg.trim();
    }
  }

  return { url, printHtml };
}

async function main() {
  const { url, printHtml } = parseArgs(process.argv.slice(2));

  if (!url) {
    throw new Error('테스트할 URL이 필요합니다. 예: npm run scraper:test -- "https://..." [--html]');
  }

  const normalizedUrl = normalizeInputUrl(url);
  const result = await runScraperTest(normalizedUrl);

  console.log("스크래퍼 테스트 결과");
  console.log(JSON.stringify(result, null, 2));

  if (printHtml) {
    const htmlDebugResults = result.debugHtml ?? [];

    if (htmlDebugResults.length === 0) {
      console.log("추가 HTML 디버그 결과가 없습니다.");
    } else {
      for (const entry of htmlDebugResults) {
        console.log(`\n===== HTML DEBUG: ${entry.label} =====`);
        console.log(`url: ${entry.url}`);
        console.log(`status: ${entry.status ?? "error"} ok=${entry.ok}`);

        if (entry.error) {
          console.log(`error: ${entry.error}`);
          continue;
        }

        console.log(entry.html ?? "");
      }
    }
  }

  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "스크래퍼 테스트 중 오류가 발생했습니다.");
  process.exit(1);
});
