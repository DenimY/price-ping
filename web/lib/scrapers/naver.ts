import {
  cleanTitle,
  EMPTY_SCRAPE_RESULT,
  extractMetaContent,
  extractTitleTag,
  fetchHtml,
  fetchHtmlDebug,
  parsePriceText,
  scrapeWithPuppeteerCandidates
} from "./common";
import type { MallScraper, ScraperHtmlDebugResult } from "./types";

function extractProductNo(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/products\/(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function getCandidateUrls(url: string) {
  const productNo = extractProductNo(url);

  return [url, productNo ? `https://shopping.naver.com/window-products/${productNo}` : null].filter(
    (value): value is string => Boolean(value)
  );
}

async function debugHtml(url: string): Promise<ScraperHtmlDebugResult[]> {
  const candidateUrls = getCandidateUrls(url);

  return Promise.all(
    candidateUrls.map((candidateUrl, index) =>
      fetchHtmlDebug(index === 0 ? "origin" : `fallback_${index}`, candidateUrl)
    )
  );
}

async function scrapeFromHtml(url: string) {
  const candidateUrls = getCandidateUrls(url);

  for (const candidateUrl of candidateUrls) {
    try {
      const html = await fetchHtml(candidateUrl);

      if (!html) {
        continue;
      }

      const title =
        cleanTitle(extractMetaContent(html, "kakao:commerce:product_name")) ??
        cleanTitle(extractMetaContent(html, "og:title")) ??
        cleanTitle(extractMetaContent(html, "twitter:title")) ??
        cleanTitle(extractTitleTag(html));

      const imageUrl =
        extractMetaContent(html, "og:image") ?? extractMetaContent(html, "twitter:image");

      const lastPrice =
        parsePriceText(extractMetaContent(html, "kakao:commerce:price")) ??
        parsePriceText(extractMetaContent(html, "product:price:amount")) ??
        parsePriceText(extractMetaContent(html, "kakao:commerce:regular_price"));

      if (title || imageUrl || lastPrice !== null) {
        return {
          title,
          imageUrl,
          lastPrice
        };
      }
    } catch {
      // 다음 후보 URL 시도
    }
  }

  return EMPTY_SCRAPE_RESULT;
}

async function scrapeWithPuppeteer(url: string) {
  return scrapeWithPuppeteerCandidates(getCandidateUrls(url), () => {
    const titleSelectors = [
      "h1[class*='prod']",
      "h1[class*='Product']",
      "h1[class*='title']",
      "h3._22kNQuEXmb",
      ".bd5LLtJ0jF",
      "h3[class*='prod']",
      "h3[class*='Product']",
      "h2[class*='prod']",
      "[data-shp-area='product_title']",
      "[data-shp-area='pdt_name']"
    ];

    const priceSelectors = [
      "strong[class*='total-price']",
      "strong[class*='sale-price']",
      "strong[class*='price']",
      "span[class*='price'] strong",
      "em[class*='price']",
      "[data-shp-area='sale_price']",
      "[data-shp-area='price']"
    ];

    const imageSelectors = [
      "meta[property='og:image']",
      "img[class*='image']",
      "img[class*='thumbnail']"
    ];

    let title: string | null = null;

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim() ?? null;
      if (text && text !== "네이버+ 스토어") {
        title = text;
        break;
      }
    }

    if (!title) {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((element) => element.textContent?.trim() ?? "")
        .filter((text) => text.length >= 8 && text !== "네이버+ 스토어");

      title = headings[0] ?? null;
    }

    let priceText: string | null = null;

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim() ?? null;
      if (text && /\d/.test(text)) {
        priceText = text;
        break;
      }
    }

    let imageUrl: string | null = null;

    for (const selector of imageSelectors) {
      const element = document.querySelector(selector);

      if (element instanceof HTMLMetaElement) {
        imageUrl = element.content || null;
      } else if (element instanceof HTMLImageElement) {
        imageUrl = element.src || null;
      }

      if (imageUrl) {
        break;
      }
    }

    return { title, priceText, imageUrl };
  });
}

export const naverScraper: MallScraper = {
  mall: "naver_store",
  async scrape(url: string) {
    let scraped = await scrapeFromHtml(url);

    if (!scraped.title && !scraped.imageUrl && scraped.lastPrice === null) {
      scraped = await scrapeWithPuppeteer(url);
    }

    return scraped;
  },
  debugHtml
};
