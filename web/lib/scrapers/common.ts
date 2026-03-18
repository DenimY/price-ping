import puppeteer from "puppeteer";
import type { ScrapeResult, ScraperHtmlDebugResult } from "./types";

export const EMPTY_SCRAPE_RESULT: ScrapeResult = {
  title: null,
  imageUrl: null,
  lastPrice: null
};

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
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return response.text();
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
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8"
    });

    for (const candidateUrl of candidateUrls) {
      try {
        await page.goto(candidateUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });

        await page.waitForFunction(
          () => {
            const text = document.body?.innerText ?? "";
            return text.includes("원") || text.length > 1000;
          },
          { timeout: 15000 }
        );

        const data = await page.evaluate(evaluate);

        if (data.title || data.imageUrl || data.priceText) {
          return {
            title: data.title,
            imageUrl: data.imageUrl,
            lastPrice: parsePriceText(data.priceText)
          };
        }
      } catch {
        // 다음 후보 URL 시도
      }
    }

    return EMPTY_SCRAPE_RESULT;
  } finally {
    await browser.close();
  }
}
