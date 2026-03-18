type RequiredKakaoEnvName =
  | "KAKAO_BIZ_BASE_URL"
  | "KAKAO_BIZ_CLIENT_ID"
  | "KAKAO_BIZ_CLIENT_SECRET"
  | "KAKAO_BIZ_SENDER_KEY"
  | "KAKAO_BIZ_TEMPLATE_CODE_PRICE_ALERT"
  | "KAKAO_BIZ_SENDER_NO";

function requireEnv(name: RequiredKakaoEnvName, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  }

  return value;
}

export function hasKakaoBizConfig() {
  return Boolean(
    process.env.KAKAO_BIZ_BASE_URL &&
      process.env.KAKAO_BIZ_CLIENT_ID &&
      process.env.KAKAO_BIZ_CLIENT_SECRET &&
      process.env.KAKAO_BIZ_SENDER_KEY &&
      process.env.KAKAO_BIZ_TEMPLATE_CODE_PRICE_ALERT &&
      process.env.KAKAO_BIZ_SENDER_NO
  );
}

export function getKakaoBizConfig() {
  return {
    baseUrl: requireEnv("KAKAO_BIZ_BASE_URL", process.env.KAKAO_BIZ_BASE_URL),
    clientId: requireEnv("KAKAO_BIZ_CLIENT_ID", process.env.KAKAO_BIZ_CLIENT_ID),
    clientSecret: requireEnv("KAKAO_BIZ_CLIENT_SECRET", process.env.KAKAO_BIZ_CLIENT_SECRET),
    senderKey: requireEnv("KAKAO_BIZ_SENDER_KEY", process.env.KAKAO_BIZ_SENDER_KEY),
    priceAlertTemplateCode: requireEnv(
      "KAKAO_BIZ_TEMPLATE_CODE_PRICE_ALERT",
      process.env.KAKAO_BIZ_TEMPLATE_CODE_PRICE_ALERT
    ),
    senderNo: requireEnv("KAKAO_BIZ_SENDER_NO", process.env.KAKAO_BIZ_SENDER_NO)
  };
}
