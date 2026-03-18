import { getKakaoBizConfig } from "@/lib/kakao/directConfig";

type KakaoTemplateVariables = Record<string, string>;

type SendKakaoAlimtalkInput = {
  to: string;
  templateCode?: string;
  message?: string;
  variables: KakaoTemplateVariables;
};

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

function normalizePhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");

  if (!digits) {
    throw new Error("전화번호가 비어 있습니다.");
  }

  return digits;
}

function buildKakaoMessage(variables: KakaoTemplateVariables) {
  return `[Price Ping]
${variables["#{상품명}"]} 가격이 ${variables["#{현재가격}"]}원으로 변경되었습니다.
설정한 조건: ${variables["#{조건명}"]}
상품 보기: ${variables["#{상품링크}"]}`;
}

async function getKakaoAccessToken() {
  const config = getKakaoBizConfig();

  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const response = await fetch(`${config.baseUrl}/v2/oauth/token`, {
    method: "POST",
    headers: {
      accept: "*/*",
      Authorization: `Basic ${config.clientId} ${config.clientSecret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    })
  });

  const result = (await response.json().catch(() => ({}))) as {
    code?: string;
    access_token?: string;
    expires_in?: number;
    result?: {
      detail_message?: string;
    };
  };

  if (!response.ok || !["200", "201"].includes(result.code ?? "") || !result.access_token) {
    throw new Error(result.result?.detail_message ?? "카카오 OAuth 토큰 발급에 실패했습니다.");
  }

  cachedAccessToken = result.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max((result.expires_in ?? 0) - 60, 60) * 1000;

  return cachedAccessToken;
}

export function buildPriceAlertVariables(input: {
  title: string;
  priceText: string;
  conditionLabel: string;
  productUrl: string;
}) {
  return {
    "#{상품명}": input.title,
    "#{현재가격}": input.priceText,
    "#{조건명}": input.conditionLabel,
    "#{상품링크}": input.productUrl
  };
}

export async function sendKakaoAlimtalk({
  to,
  templateCode,
  message,
  variables
}: SendKakaoAlimtalkInput) {
  const config = getKakaoBizConfig();
  const accessToken = await getKakaoAccessToken();
  const cid = `priceping-${Date.now()}`;

  const response = await fetch(`${config.baseUrl}/v2/send/kakao`, {
    method: "POST",
    headers: {
      accept: "*/*",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message_type: "AT",
      sender_key: config.senderKey,
      cid,
      template_code: templateCode ?? config.priceAlertTemplateCode,
      phone_number: normalizePhoneNumber(to),
      sender_no: config.senderNo,
      message: message ?? buildKakaoMessage(variables),
      fall_back_yn: false
    })
  });

  const result = (await response.json().catch(() => ({}))) as {
    code?: string;
    uid?: string;
    cid?: string;
    result?: {
      detail_code?: string;
      detail_message?: string;
    };
  };

  if (!response.ok || result.code !== "200") {
    throw new Error(result.result?.detail_message ?? "카카오 알림톡 발송에 실패했습니다.");
  }

  return {
    uid: result.uid ?? null,
    cid: result.cid ?? cid,
    code: result.code ?? null,
    detailCode: result.result?.detail_code ?? null,
    detailMessage: result.result?.detail_message ?? null
  };
}
