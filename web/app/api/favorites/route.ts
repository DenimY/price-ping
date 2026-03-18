import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isApprovedProfile } from "@/lib/accessControl";

type FavoriteRow = {
  id: number;
  memo: string | null;
  created_at: string;
  products:
    | {
        id: number;
        mall: string;
        title: string | null;
        image_url: string | null;
        last_price: number | null;
        url: string;
      }
    | Array<{
        id: number;
        mall: string;
        title: string | null;
        image_url: string | null;
        last_price: number | null;
        url: string;
      }>
    | null;
};

type AlertRuleRow = {
  product_id: number;
  type: "target_price" | "price_drop" | "price_change";
  target_price: number | null;
  baseline_price: number | null;
  active: boolean;
};

type AlertRuleSummary = Omit<AlertRuleRow, "product_id">;

function getFavoriteProduct(favorite: FavoriteRow) {
  if (Array.isArray(favorite.products)) {
    return favorite.products[0] ?? null;
  }

  return favorite.products ?? null;
}

export async function GET() {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isApprovedProfile(profile)) {
    return NextResponse.json({ error: "관리자 승인 후 이용할 수 있습니다." }, { status: 403 });
  }

  const { data: favorites, error } = await supabase
    .from("favorites")
    .select(
      `
        id,
        memo,
        created_at,
        products (
          id,
          mall,
          title,
          image_url,
          last_price,
          url
        )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const favoriteRows = (favorites ?? []) as unknown as FavoriteRow[];
  const productIds = favoriteRows
    .map((favorite) => getFavoriteProduct(favorite)?.id)
    .filter((id): id is number => typeof id === "number");

  let alertMap = new Map<number, AlertRuleSummary>();

  if (productIds.length > 0) {
    const { data: alertRules, error: alertError } = await supabase
      .from("alert_rules")
      .select("product_id, type, target_price, baseline_price, active")
      .eq("user_id", user.id)
      .in("product_id", productIds);

    if (alertError) {
      return NextResponse.json({ error: alertError.message }, { status: 500 });
    }

    alertMap = new Map(
      ((alertRules ?? []) as AlertRuleRow[]).map((rule) => [
        rule.product_id,
        {
          type: rule.type,
          target_price: rule.target_price,
          baseline_price: rule.baseline_price,
          active: rule.active
        }
      ])
    );
  }

  const response = favoriteRows.map((favorite) => {
    const product = getFavoriteProduct(favorite);

    return {
      favorite_id: favorite.id,
      product_id: product?.id ?? null,
      mall: product?.mall ?? null,
      product_title: product?.title ?? null,
      product_image_url: product?.image_url ?? null,
      product_url: product?.url ?? null,
      last_price: product?.last_price ?? null,
      memo: favorite.memo,
      alert_type: product?.id ? alertMap.get(product.id)?.type ?? null : null,
      target_price: product?.id
        ? alertMap.get(product.id)?.target_price ?? null
        : null,
      baseline_price: product?.id
        ? alertMap.get(product.id)?.baseline_price ?? null
        : null,
      alert_active: product?.id
        ? alertMap.get(product.id)?.active ?? false
        : false,
      created_at: favorite.created_at
    };
  });

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isApprovedProfile(profile)) {
    return NextResponse.json({ error: "관리자 승인 후 이용할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json()) as {
    product_id?: number;
    memo?: string;
  };

  if (!body.product_id) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("favorites")
    .upsert(
      {
        user_id: user.id,
        product_id: body.product_id,
        memo: body.memo ?? null
      },
      {
        onConflict: "user_id,product_id"
      }
    )
    .select("id, product_id, memo, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ favorite: data }, { status: 201 });
}

