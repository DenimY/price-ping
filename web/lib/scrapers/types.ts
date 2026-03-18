import type { SupportedMall } from "../mall";

export type ScrapeResult = {
  title: string | null;
  imageUrl: string | null;
  lastPrice: number | null;
};

export type ScraperTestResult = {
  url: string;
  mall: SupportedMall | null;
  supported: boolean;
  success: boolean;
  missingTitle: boolean;
  missingLastPrice: boolean;
  durationMs: number;
  scraped: ScrapeResult;
  debugHtml?: ScraperHtmlDebugResult[];
};

export type ScraperHtmlDebugResult = {
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  html: string | null;
  error: string | null;
};

export type MallScraper = {
  mall: SupportedMall;
  scrape: (url: string) => Promise<ScrapeResult>;
  debugHtml?: (url: string) => Promise<ScraperHtmlDebugResult[]>;
};
