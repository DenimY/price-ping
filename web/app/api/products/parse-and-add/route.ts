import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isApprovedProfile } from "@/lib/accessControl";
import { detectSupportedMall, normalizeInputUrl } from "@/lib/mall";
import { resolveProductDetailsByMall } from "@/lib/scrapers";

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isApprovedProfile(profile)) {
    return NextResponse.json({ error: "관리자 승인 후 이용할 수 있습니다." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      url?: string;
      manual_current_price?: number | null;
      manual_title?: string | null;
      preview_only?: boolean;
    };
    const url = body.url ? normalizeInputUrl(body.url) : "";
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
    if (!mall) {
      return NextResponse.json(
        {
          error:
            "현재는 네이버 스마트스토어, 네이버플러스 스토어, 쿠팡, Supreme URL을 지원합니다."
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

    if (previewOnly) {
      const scraped = await resolveProductDetailsByMall(url, mall);
      const resolvedTitle = manualTitle ?? scraped.title;
      const finalLastPrice = manualCurrentPrice ?? scraped.lastPrice;
      const lastCheckedAt = finalLastPrice !== null || resolvedTitle ? new Date().toISOString() : null;

      return NextResponse.json({
        product: {
          id: existingProduct?.id ?? null,
          url,
          mall,
          title: resolvedTitle,
          image_url: scraped.imageUrl,
          currency: existingProduct?.currency ?? "KRW",
          last_price: finalLastPrice,
          last_checked_at: lastCheckedAt
        }
      });
    }

    if (existingProduct) {
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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "상품 정보 처리 중 알 수 없는 오류가 발생했습니다."
      },
      { status: 500 }
    );
  }
}

