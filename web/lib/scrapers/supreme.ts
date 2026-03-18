import {
  cleanTitle,
  EMPTY_SCRAPE_RESULT,
  extractMetaContent,
  extractTitleTag,
  fetchHtml,
  fetchHtmlDebug,
  isMeaningfulTitle,
  parsePriceText,
  scrapeWithPuppeteerCandidates
} from "./common";
import type { MallScraper } from "./types";

function cleanSupremeTitle(value: string | null) {
  const cleaned = cleanTitle(value);

  if (!cleaned) {
    return null;
  }

  return cleaned.replace(/\s*-\s*Shop(?:\s*-\s*Supreme)?$/i, "").trim();
}

function extractSupremePrice(html: string) {
  const amountMatch = html.match(/"price"\s*:\s*\{\s*"amount"\s*:\s*([0-9.]+)\s*,\s*"currencyCode"\s*:\s*"([A-Z]+)"/i);

  if (amountMatch?.[1]) {
    const amount = Number(amountMatch[1]);

    if (!Number.isNaN(amount) && amount > 0) {
      return Math.round(amount);
    }
  }

  const variantPriceMatch = html.match(/"variants":\[\{"id":[0-9]+,"price":([0-9]+)/i);

  if (variantPriceMatch?.[1]) {
    const rawPrice = Number(variantPriceMatch[1]);

    if (!Number.isNaN(rawPrice) && rawPrice > 0) {
      return Math.round(rawPrice / 100);
    }
  }

  return null;
}

async function scrapeFromHtml(url: string) {
  try {
    const html = await fetchHtml(url);

    if (!html) {
      return EMPTY_SCRAPE_RESULT;
    }

    const title =
      cleanSupremeTitle(extractMetaContent(html, "og:title")) ??
      cleanSupremeTitle(extractMetaContent(html, "twitter:title")) ??
      cleanSupremeTitle(extractTitleTag(html));
    const resolvedTitle = isMeaningfulTitle(title) ? title : null;

    const imageUrl =
      extractMetaContent(html, "og:image") ?? extractMetaContent(html, "twitter:image");

    const lastPrice =
      extractSupremePrice(html) ??
      parsePriceText(extractMetaContent(html, "product:price:amount")) ??
      parsePriceText(extractMetaContent(html, "og:price:amount"));

    if (resolvedTitle || imageUrl || lastPrice !== null) {
      return {
        title: resolvedTitle,
        imageUrl,
        lastPrice
      };
    }

    return EMPTY_SCRAPE_RESULT;
  } catch {
    return EMPTY_SCRAPE_RESULT;
  }
}

async function scrapeWithPuppeteer(url: string) {
  return scrapeWithPuppeteerCandidates([url], () => {
    const titleSelectors = ["h1", "h2[class*='product']", "h2[class*='Product']"];
    const priceSelectors = [
      "[class*='price']",
      "[class*='Price']",
      "[data-product-price]",
      "span"
    ];
    const imageSelectors = [
      "meta[property='og:image']",
      "img[class*='product']",
      "img[class*='Product']"
    ];

    let title: string | null = null;

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim() ?? null;

      if (text) {
        title = text;
        break;
      }
    }

    let priceText: string | null = null;

    for (const selector of priceSelectors) {
      const elements = Array.from(document.querySelectorAll(selector));

      for (const element of elements) {
        const text = element.textContent?.trim() ?? null;

        if (text && /\d/.test(text)) {
          priceText = text;
          break;
        }
      }

      if (priceText) {
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

export const supremeScraper: MallScraper = {
  mall: "supreme",
  async scrape(url: string) {
    const htmlScraped = await scrapeFromHtml(url);

    if (isMeaningfulTitle(htmlScraped.title) && htmlScraped.lastPrice !== null) {
      return htmlScraped;
    }

    const dynamicScraped = await scrapeWithPuppeteer(url);

    return {
      title: isMeaningfulTitle(dynamicScraped.title) ? dynamicScraped.title : htmlScraped.title,
      imageUrl: dynamicScraped.imageUrl ?? htmlScraped.imageUrl,
      lastPrice: dynamicScraped.lastPrice ?? htmlScraped.lastPrice
    };
  },
  async debugHtml(url: string) {
    return [await fetchHtmlDebug("origin", url)];
  }
};
