export type SupportedMall = "naver_store" | "naver_plus_store" | "coupang";

export function normalizeInputUrl(input: string) {
  let value = input.trim();

  const jsonUrlMatch = value.match(/"url"\s*:\s*"([^"]+)"/);
  if (jsonUrlMatch?.[1]) {
    value = jsonUrlMatch[1];
  }

  return value
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/")
    .replaceAll("\\", "")
    .replace(/^['"]+/, "")
    .replace(/[',"]+$/, "")
    .trim();
}

export function detectSupportedMall(url: string): SupportedMall | null {
  try {
    const parsed = new URL(normalizeInputUrl(url));
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

    if (
      hostname === "coupang.com" ||
      hostname === "www.coupang.com" ||
      hostname === "m.coupang.com" ||
      hostname.endsWith(".coupang.com")
    ) {
      return "coupang";
    }

    return null;
  } catch {
    return null;
  }
}

export function getMallDisplayInfo(mall: string | null | undefined) {
  switch (mall) {
    case "naver_plus_store":
      return {
        label: "네이버플러스 스토어",
        shortLabel: "N+",
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      };
    case "coupang":
      return {
        label: "쿠팡",
        shortLabel: "C",
        className: "border-red-500/40 bg-red-500/10 text-red-300"
      };
    case "naver_store":
    default:
      return {
        label: "네이버 스마트스토어",
        shortLabel: "N",
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      };
  }
}
