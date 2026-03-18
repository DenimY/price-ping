import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isApprovedProfile } from "@/lib/accessControl";

const ALLOWED_ALERT_TYPES = ["target_price", "price_drop", "price_change"] as const;

type AlertType = (typeof ALLOWED_ALERT_TYPES)[number];

export async function GET() {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isApprovedProfile(profile)) {
    return NextResponse.json({ error: "관리자 승인 후 이용할 수 있습니다." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("alert_rules")
    .select("id, product_id, type, target_price, baseline_price, active, last_triggered_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
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
    type?: string;
    target_price?: number | null;
    baseline_price?: number | null;
    active?: boolean;
  };

  if (!body.product_id) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }

  const type = (body.type ?? "price_drop") as AlertType;

  if (!ALLOWED_ALERT_TYPES.includes(type)) {
    return NextResponse.json({ error: "지원하지 않는 알림 타입입니다." }, { status: 400 });
  }

  const targetPrice = body.target_price ?? null;
  const baselinePrice = body.baseline_price ?? null;

  if (type === "target_price" && (targetPrice === null || targetPrice <= 0)) {
    return NextResponse.json(
      { error: "목표 가격 알림은 0보다 큰 target_price가 필요합니다." },
      { status: 400 }
    );
  }

  if (type !== "target_price" && (baselinePrice === null || baselinePrice <= 0)) {
    return NextResponse.json(
      { error: "등록 당시 가격 기준 알림은 0보다 큰 baseline_price가 필요합니다." },
      { status: 400 }
    );
  }

  const { error: cleanupError } = await supabase
    .from("alert_rules")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", body.product_id)
    .neq("type", type);

  if (cleanupError) {
    return NextResponse.json({ error: cleanupError.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("alert_rules")
    .upsert(
      {
        user_id: user.id,
        product_id: body.product_id,
        type,
        target_price: type === "target_price" ? targetPrice : null,
        baseline_price: type === "target_price" ? null : baselinePrice,
        active: body.active ?? true,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,product_id,type"
      }
    )
    .select("id, product_id, type, target_price, baseline_price, active, last_triggered_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ alert_rule: data });
}

