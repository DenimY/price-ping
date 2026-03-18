import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPriceAlertVariables, sendKakaoAlimtalk } from "@/lib/kakao/direct";
import { hasKakaoBizConfig } from "@/lib/kakao/directConfig";

type KakaoNotificationInput = {
  supabase: SupabaseClient;
  userId?: string | null;
  phoneNumber: string;
  productId?: number | null;
  alertRuleId?: number | null;
  title: string;
  price: number;
  conditionLabel: string;
  productUrl: string;
  templateCode?: string;
};

export async function sendKakaoPriceAlert(input: KakaoNotificationInput) {
  if (!hasKakaoBizConfig()) {
    throw new Error("카카오 비즈메시지 직접 연동 설정이 완료되지 않았습니다.");
  }

  const priceText = input.price.toLocaleString("ko-KR");
  const notificationTitle = "가격 조건이 충족되었습니다.";
  const notificationMessage = `${input.title} 가격이 ${priceText}원으로 변경되었습니다.`;

  let notificationId: number | null = null;

  if (input.userId && input.productId) {
    const { data, error } = await input.supabase
      .from("notifications")
      .insert({
        user_id: input.userId,
        product_id: input.productId,
        alert_rule_id: input.alertRuleId ?? null,
        channel: "kakao",
        title: notificationTitle,
        message: notificationMessage,
        status: "pending"
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    notificationId = data.id as number;
  }

  try {
    const variables = buildPriceAlertVariables({
      title: input.title,
      priceText,
      conditionLabel: input.conditionLabel,
      productUrl: input.productUrl
    });

    const result = await sendKakaoAlimtalk({
      to: input.phoneNumber,
      templateCode: input.templateCode,
      variables
    });

    if (notificationId) {
      await input.supabase
        .from("notifications")
        .update({
          sent_at: new Date().toISOString(),
          status: "sent",
          error_message: null
        })
        .eq("id", notificationId);
    }

    return {
      notificationId,
      ...result
    };
  } catch (error) {
    if (notificationId) {
      await input.supabase
        .from("notifications")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "카카오 알림 발송에 실패했습니다."
        })
        .eq("id", notificationId);
    }

    throw error;
  }
}
