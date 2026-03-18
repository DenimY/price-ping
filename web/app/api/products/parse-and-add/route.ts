import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

function detectSupportedMall(url: string): "naver_store" | "naver_plus_store" | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "smartstore.naver.com" || hostname.endsWith(".smartstore.naver.com")) {
      return "naver_store";
    }

    if (
      hostname === "shopping.naver.com" ||
      hostname === "m.shopping.naver.com" ||
      hostname === "brand.naver.com"
    ) {
      return "naver_plus_store";
    }

    return null;
  } catch {
    return null;
  }
}

function extractProductNo(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/products\/(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function parsePriceText(value: string | null | undefined) {
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

function extractMetaContent(html: string, key: string) {
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

function extractTitleTag(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function cleanTitle(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+\|\s+.+$/, "").trim();
}

async function scrapeFromHtml(url: string, productNo: string | null) {
  const candidateUrls = [
    url,
    productNo ? `https://shopping.naver.com/window-products/${productNo}` : null
  ].filter((value): value is string => Boolean(value));

  for (const candidateUrl of candidateUrls) {
    try {
      const response = await fetch(candidateUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8",
          "cache-control": "no-cache"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();

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

  return {
    title: null,
    imageUrl: null,
    lastPrice: null
  };
}

async function scrapeWithPuppeteer(url: string, productNo: string | null) {
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

    const candidateUrls = [
      productNo ? `https://shopping.naver.com/window-products/${productNo}` : null,
      url
    ].filter((value): value is string => Boolean(value));

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

        const data = await page.evaluate(() => {
          const titleSelectors = [
            "h3._22kNQuEXmb",
            ".bd5LLtJ0jF",
            "h3[class*='prod']",
            "h3[class*='Product']",
            "h2[class*='prod']",
            "[data-shp-area='product_title']",
            "[data-shp-area='pdt_name']"
          ];

          const priceSelectors = [
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

        if (data.title) {
          return {
            title: data.title,
            imageUrl: data.imageUrl,
            lastPrice: parsePriceText(data.priceText)
          };
        }
      } catch {
        // 다음 후보 URL로 fallback
      }
    }

    return {
      title: null,
      imageUrl: null,
      lastPrice: null
    };
  } finally {
    await browser.close();
  }
}

async function resolveProductDetails(url: string, productNo: string | null) {
  let scraped = await scrapeFromHtml(url, productNo);

  if (!scraped.title && !scraped.imageUrl && scraped.lastPrice === null) {
    scraped = await scrapeWithPuppeteer(url, productNo);
  }

  return scraped;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    url?: string;
    manual_current_price?: number | null;
    manual_title?: string | null;
    preview_only?: boolean;
  };
  const url = body.url?.trim();
  const manualCurrentPrice =
    typeof body.manual_current_price === "number" ? body.manual_current_price : null;
  const manualTitle = body.manual_title?.trim() || null;
  const previewOnly = body.preview_only === true;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (manualCurrentPrice !== null && manualCurrentPrice <= 0) {
    return NextResponse.json(
      { error: "manual_current_price must be greater than 0" },
      { status: 400 }
    );
  }

  if (!previewOnly && !manualTitle) {
    return NextResponse.json(
      { error: "상품명은 필수입니다. 자동 수집 버튼을 누르거나 직접 입력해주세요." },
      { status: 400 }
    );
  }

  if (!previewOnly && manualCurrentPrice === null) {
    return NextResponse.json(
      { error: "현재 가격은 필수입니다. 자동 수집 버튼을 누르거나 직접 입력해주세요." },
      { status: 400 }
    );
  }

  const mall = detectSupportedMall(url);
  const productNo = extractProductNo(url);

  if (!mall) {
    return NextResponse.json(
      {
        error:
          "현재는 네이버 스마트스토어와 네이버플러스 스토어 URL만 지원합니다."
      },
      { status: 400 }
    );
  }

  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id, url, mall, title, image_url, currency, last_price, last_checked_at")
    .eq("url", url)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingProduct) {
    if (
      previewOnly &&
      existingProduct.title &&
      existingProduct.last_price !== null &&
      manualCurrentPrice === null &&
      !manualTitle
    ) {
      return NextResponse.json({ product: existingProduct });
    }

    if (previewOnly) {
      const scraped = await resolveProductDetails(url, productNo);
      const resolvedTitle = manualTitle ?? scraped.title ?? existingProduct.title;
      const resolvedImageUrl = scraped.imageUrl ?? existingProduct.image_url;
      const finalLastPrice = manualCurrentPrice ?? scraped.lastPrice ?? existingProduct.last_price;
      const lastCheckedAt =
        finalLastPrice !== null || resolvedTitle
          ? new Date().toISOString()
          : existingProduct.last_checked_at;

      return NextResponse.json({
        product: {
          ...existingProduct,
          title: resolvedTitle,
          image_url: resolvedImageUrl,
          last_price: finalLastPrice,
          last_checked_at: lastCheckedAt
        }
      });
    }

    const lastCheckedAt = new Date().toISOString();
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        title: manualTitle,
        last_price: manualCurrentPrice,
        last_checked_at: lastCheckedAt
      })
      .eq("id", existingProduct.id)
      .select("id, url, mall, title, image_url, currency, last_price, last_checked_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ product: updatedProduct });
  }

  if (previewOnly) {
    const scraped = await resolveProductDetails(url, productNo);
    const resolvedTitle = manualTitle ?? scraped.title;
    const finalLastPrice = manualCurrentPrice ?? scraped.lastPrice;
    const lastCheckedAt = finalLastPrice !== null || resolvedTitle ? new Date().toISOString() : null;

    return NextResponse.json({
      product: {
        id: null,
        url,
        mall,
        title: resolvedTitle,
        image_url: scraped.imageUrl,
        currency: "KRW",
        last_price: finalLastPrice,
        last_checked_at: lastCheckedAt
      }
    });
  }

  const lastCheckedAt = new Date().toISOString();

  const { data: createdProduct, error: insertError } = await supabase
    .from("products")
    .insert({
      url,
      mall,
      title: manualTitle,
      image_url: null,
      last_price: manualCurrentPrice,
      last_checked_at: lastCheckedAt
    })
    .select("id, url, mall, title, image_url, currency, last_price, last_checked_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ product: createdProduct }, { status: 201 });
}

