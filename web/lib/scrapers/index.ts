import { detectSupportedMall, normalizeInputUrl, type SupportedMall } from "../mall";
import { EMPTY_SCRAPE_RESULT } from "./common";
import { coupangScraper } from "./coupang";
import { naverScraper } from "./naver";
import type {
  MallScraper,
  ScrapeResult,
  ScraperHtmlDebugResult,
  ScraperTestResult
} from "./types";

const SCRAPERS: Partial<Record<SupportedMall, MallScraper>> = {
  naver_store: naverScraper,
  naver_plus_store: naverScraper,
  coupang: coupangScraper
};

async function getScraperHtmlDebugByMall(url: string, mall: SupportedMall): Promise<ScraperHtmlDebugResult[]> {
  const scraper = SCRAPERS[mall];

  if (!scraper?.debugHtml) {
    return [];
  }

  return scraper.debugHtml(url);
}

export async function resolveProductDetailsByMall(url: string, mall: SupportedMall): Promise<ScrapeResult> {
  const normalizedUrl = normalizeInputUrl(url);
  const scraper = SCRAPERS[mall];

  if (!scraper) {
    return EMPTY_SCRAPE_RESULT;
  }

  return scraper.scrape(normalizedUrl);
}

export async function runScraperTest(url: string): Promise<ScraperTestResult> {
  const startedAt = Date.now();
  const normalizedUrl = normalizeInputUrl(url);
  const mall = detectSupportedMall(normalizedUrl);

  if (!mall) {
    return {
      url: normalizedUrl,
      mall: null,
      supported: false,
      success: false,
      missingTitle: true,
      missingLastPrice: true,
      durationMs: Date.now() - startedAt,
      scraped: EMPTY_SCRAPE_RESULT
    };
  }

  const scraped = await resolveProductDetailsByMall(normalizedUrl, mall);
  const missingTitle = !scraped.title;
  const missingLastPrice = scraped.lastPrice === null;
  const success = !missingTitle && !missingLastPrice;
  const debugHtml = !success ? await getScraperHtmlDebugByMall(normalizedUrl, mall) : undefined;

  return {
    url: normalizedUrl,
    mall,
    supported: true,
    success,
    missingTitle,
    missingLastPrice,
    durationMs: Date.now() - startedAt,
    scraped,
    debugHtml
  };
}

export async function getScraperHtmlDebug(url: string): Promise<ScraperHtmlDebugResult[]> {
  const normalizedUrl = normalizeInputUrl(url);
  const mall = detectSupportedMall(normalizedUrl);

  if (!mall) {
    return [];
  }

  return getScraperHtmlDebugByMall(normalizedUrl, mall);
}
