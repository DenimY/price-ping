import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";
import { sendKakaoPriceAlert } from "@/lib/notifications/kakao";

type TestBody = {
  to?: string;
  user_id?: string;
  product_id?: number;
  title?: string;
  price?: number;
  condition_label?: string;
  product_url?: string;
};

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminProfile(profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as TestBody;
  let phoneNumber = body.to?.trim() || null;
  let targetUserId = body.user_id ?? null;

  if (targetUserId && !phoneNumber) {
    const { data: targetProfile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetUserId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const targetPhoneNumber =
      targetProfile && typeof targetProfile.phone_number === "string"
        ? targetProfile.phone_number
        : null;
    const targetConsent =
      targetProfile && typeof targetProfile.kakao_alert_consent === "boolean"
        ? targetProfile.kakao_alert_consent
        : false;

    if (!targetPhoneNumber) {
      return NextResponse.json({ error: "대상 사용자의 전화번호가 없습니다." }, { status: 400 });
    }

    if (!targetConsent) {
      return NextResponse.json(
        { error: "대상 사용자가 카카오 알림 수신에 동의하지 않았습니다." },
        { status: 400 }
      );
    }

    phoneNumber = targetPhoneNumber;
    targetUserId = typeof targetProfile.id === "string" ? targetProfile.id : targetUserId;
  }

  if (!phoneNumber) {
    return NextResponse.json({ error: "to 또는 user_id가 필요합니다." }, { status: 400 });
  }

  const price = typeof body.price === "number" && body.price > 0 ? body.price : 123456;

  try {
    const result = await sendKakaoPriceAlert({
      supabase,
      userId: targetUserId,
      phoneNumber,
      productId: body.product_id ?? null,
      title: body.title?.trim() || "테스트 상품",
      price,
      conditionLabel: body.condition_label?.trim() || "테스트 발송",
      productUrl: body.product_url?.trim() || "https://example.com/product"
    });

    return NextResponse.json({
      ok: true,
      result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "카카오 알림 테스트 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
