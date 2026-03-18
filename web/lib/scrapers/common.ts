import puppeteer, { type Browser } from "puppeteer";
import type { ScrapeResult, ScraperHtmlDebugResult } from "./types";

export const EMPTY_SCRAPE_RESULT: ScrapeResult = {
  title: null,
  imageUrl: null,
  lastPrice: null
};

const SCRAPER_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

function debugScraperLog(scope: string, message: string, meta?: Record<string, unknown>) {
  if (!SCRAPER_DEBUG_ENABLED) {
    return;
  }

  if (meta) {
    console.log(`[SCRAPER:${scope}] ${message}`, meta);
    return;
  }

  console.log(`[SCRAPER:${scope}] ${message}`);
}

function truncateForLog(value: string | null | undefined, limit = 240) {
  if (!value) {
    return null;
  }

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

export function parsePriceText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function extractMetaContent(html: string, key: string) {
  const keyPattern = escapeRegExp(key);
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${keyPattern}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${keyPattern}["'][^>]*>`,
      "i"
    )
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

export function extractTitleTag(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

export function cleanTitle(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+\|\s+.+$/, "").trim();
}

export function isMeaningfulTitle(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized !== "네이버+ 스토어";
}

export function extractJsonLdProduct(html: string): ScrapeResult {
  const scriptMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scriptMatches) {
    const rawJson = match[1]?.trim();

    if (!rawJson) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawJson);
      const candidates = Array.isArray(parsed)
        ? parsed
        : [parsed, ...(Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [])];

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") {
          continue;
        }

        const type = candidate["@type"];
        const image = Array.isArray(candidate.image) ? candidate.image[0] : candidate.image ?? null;
        const offers = Array.isArray(candidate.offers) ? candidate.offers[0] : candidate.offers;
        const price =
          typeof offers?.price === "number" || typeof offers?.price === "string"
            ? parsePriceText(String(offers.price))
            : null;

        if (type === "Product" || candidate.name || image || price !== null) {
          return {
            title: cleanTitle(typeof candidate.name === "string" ? candidate.name : null),
            imageUrl: typeof image === "string" ? image : null,
            lastPrice: price
          };
        }
      }
    } catch {
      // invalid json-ld는 무시
    }
  }

  return EMPTY_SCRAPE_RESULT;
}

export async function fetchHtml(url: string) {
  debugScraperLog("fetch", "request start", { url });

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "cache-control": "no-cache"
      },
      cache: "no-store"
    });

    const html = await response.text();

    debugScraperLog("fetch", "request complete", {
      requestedUrl: url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      bodyPreview: truncateForLog(html)
    });

    if (!response.ok) {
      return null;
    }

    return html;
  } catch (error) {
    debugScraperLog("fetch", "request failed", {
      url,
      error: error instanceof Error ? error.message : "unknown error"
    });

    throw error;
  }
}

export async function fetchHtmlDebug(
  label: string,
  url: string
): Promise<ScraperHtmlDebugResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "cache-control": "no-cache"
      },
      cache: "no-store"
    });

    const html = await response.text();

    return {
      label,
      url,
      ok: response.ok,
      status: response.status,
      html,
      error: null
    };
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      status: null,
      html: null,
      error: error instanceof Error ? error.message : "HTML 요청 중 오류가 발생했습니다."
    };
  }
}

type PuppeteerEvaluateResult = {
  title: string | null;
  priceText: string | null;
  imageUrl: string | null;
};

export async function scrapeWithPuppeteerCandidates(
  candidateUrls: string[],
  evaluate: () => PuppeteerEvaluateResult | Promise<PuppeteerEvaluateResult>
) {
  let browser: Browser | null = null;

  try {
    try {
      debugScraperLog("puppeteer", "browser launch start", {
        candidateCount: candidateUrls.length
      });

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });

      debugScraperLog("puppeteer", "browser launch complete");
    } catch {
      // 로컬에 Chrome이 없으면 동적 스크래핑을 생략하고 HTML 기반 결과만 사용한다.
      debugScraperLog("puppeteer", "browser launch skipped");
      return EMPTY_SCRAPE_RESULT;
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8"
    });

    for (const candidateUrl of candidateUrls) {
      try {
        debugScraperLog("puppeteer", "page goto start", {
          url: candidateUrl
        });

        const response = await page.goto(candidateUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        debugScraperLog("puppeteer", "page goto complete", {
          requestedUrl: candidateUrl,
          finalUrl: page.url(),
          status: response?.status() ?? null
        });

        await page.waitForFunction(
          () => {
            const text = document.body?.innerText ?? "";
            return text.includes("원") || text.length > 1000;
          },
          { timeout: 15000 }
        );

        const pageSnapshot = await page.evaluate(() => ({
          title: document.title,
          bodyPreview: document.body?.innerText?.slice(0, 240) ?? null
        }));

        debugScraperLog("puppeteer", "page snapshot", pageSnapshot);

        const data = await page.evaluate(evaluate);

        debugScraperLog("puppeteer", "selector evaluation complete", {
          url: candidateUrl,
          result: data
        });

        if (data.title || data.imageUrl || data.priceText) {
          return {
            title: data.title,
            imageUrl: data.imageUrl,
            lastPrice: parsePriceText(data.priceText)
          };
        }
      } catch (error) {
        debugScraperLog("puppeteer", "candidate failed", {
          url: candidateUrl,
          error: error instanceof Error ? error.message : "unknown error"
        });

        // 다음 후보 URL 시도
      }
    }

    return EMPTY_SCRAPE_RESULT;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
