import {
  cleanTitle,
  EMPTY_SCRAPE_RESULT,
  extractJsonLdProduct,
  extractMetaContent,
  extractTitleTag,
  fetchHtml,
  fetchHtmlDebug,
  parsePriceText,
  scrapeWithPuppeteerCandidates
} from "./common";
import type { MallScraper } from "./types";

async function scrapeFromHtml(url: string) {
  try {
    const html = await fetchHtml(url);

    if (!html) {
      return EMPTY_SCRAPE_RESULT;
    }

    const jsonLd = extractJsonLdProduct(html);
    const title =
      jsonLd.title ??
      cleanTitle(extractMetaContent(html, "og:title")) ??
      cleanTitle(extractMetaContent(html, "twitter:title")) ??
      cleanTitle(extractTitleTag(html));

    const imageUrl =
      jsonLd.imageUrl ?? extractMetaContent(html, "og:image") ?? extractMetaContent(html, "twitter:image");

    const lastPrice =
      jsonLd.lastPrice ??
      parsePriceText(extractMetaContent(html, "product:price:amount")) ??
      parsePriceText(extractMetaContent(html, "og:price:amount")) ??
      parsePriceText(extractMetaContent(html, "twitter:data1"));

    if (title || imageUrl || lastPrice !== null) {
      return {
        title,
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
    const titleSelectors = [
      "h1[class*='prod-buy-header__title']",
      "h1[class*='ProductInfo_productName']",
      "h1[class*='product-title']",
      "h1"
    ];

    const priceSelectors = [
      "strong[class*='total-price']",
      "strong[class*='sale-price']",
      "span[class*='priceValue']",
      "strong[class*='priceValue']",
      "em[class*='price']"
    ];

    const imageSelectors = [
      "meta[property='og:image']",
      "img[class*='prod-image']",
      "img[class*='ProductImage']"
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

export const coupangScraper: MallScraper = {
  mall: "coupang",
  async scrape(url: string) {
    let scraped = await scrapeFromHtml(url);

    if (!scraped.title && !scraped.imageUrl && scraped.lastPrice === null) {
      scraped = await scrapeWithPuppeteer(url);
    }

    return scraped;
  },
  async debugHtml(url: string) {
    return [await fetchHtmlDebug("origin", url)];
  }
};
