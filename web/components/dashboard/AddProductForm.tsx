"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AlertType = "target_price" | "price_drop" | "price_change";

const ALERT_TYPE_OPTIONS: Array<{ value: AlertType; label: string }> = [
  { value: "price_drop", label: "등록 당시 가격보다 하락" },
  { value: "target_price", label: "목표 가격 도달" },
  { value: "price_change", label: "등록 당시 가격에서 변동" }
];

type ProductResponse = {
  product: {
    id: number | null;
    url: string;
    mall: string;
    title: string | null;
    image_url: string | null;
    currency: string;
    last_price: number | null;
    last_checked_at: string | null;
  };
};

type FavoriteResponse = {
  favorite: {
    id: number;
    product_id: number;
    memo: string | null;
    created_at: string;
  };
};

type AlertRuleResponse = {
  alert_rule: {
    id: number;
    product_id: number;
    type: string;
    target_price: number | null;
    baseline_price?: number | null;
    active: boolean;
  };
};

export function AddProductForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("price_drop");
  const [targetPrice, setTargetPrice] = useState("");
  const [memo, setMemo] = useState("");
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registeredProduct, setRegisteredProduct] = useState<ProductResponse["product"] | null>(
    null
  );

  const parsedTargetPrice = useMemo(() => {
    if (!targetPrice.trim()) {
      return null;
    }

    const numericValue = Number(targetPrice.replaceAll(",", ""));
    return Number.isNaN(numericValue) ? null : numericValue;
  }, [targetPrice]);

  const parsedCurrentPrice = useMemo(() => {
    if (!currentPrice.trim()) {
      return null;
    }

    const numericValue = Number(currentPrice.replaceAll(",", ""));
    return Number.isNaN(numericValue) ? null : numericValue;
  }, [currentPrice]);

  async function handleFetchProductInfo() {
    setFetchingInfo(true);
    setError(null);
    setSuccess(null);

    try {
      if (!url.trim()) {
        throw new Error("상품 URL을 입력해주세요.");
      }

      if (parsedCurrentPrice !== null && parsedCurrentPrice <= 0) {
        throw new Error("현재 가격은 0보다 큰 값이어야 합니다.");
      }

      const response = await fetch("/api/products/parse-and-add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: url.trim(),
          manual_title: productTitle.trim() || null,
          manual_current_price: parsedCurrentPrice,
          preview_only: true
        })
      });

      const result = (await response.json()) as ProductResponse & { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "상품명/가격 자동 수집에 실패했습니다.");
      }

      setRegisteredProduct(result.product);

      if (result.product.title) {
        setProductTitle(result.product.title);
      }

      if (result.product.last_price !== null) {
        setCurrentPrice(String(result.product.last_price));
      }

      setSuccess("상품명과 현재 가격을 불러왔습니다. 필요하면 수정 후 등록하세요.");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "상품 정보 조회 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setFetchingInfo(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!url.trim()) {
        throw new Error("상품 URL을 입력해주세요.");
      }

      if (!productTitle.trim()) {
        throw new Error("상품명을 입력해주세요. 자동 수집 버튼을 누르거나 직접 입력해주세요.");
      }

      if (parsedCurrentPrice === null) {
        throw new Error("현재 가격을 입력해주세요. 자동 수집 버튼을 누르거나 직접 입력해주세요.");
      }

      if (parsedTargetPrice !== null && parsedTargetPrice <= 0) {
        throw new Error("목표 가격은 0보다 큰 값이어야 합니다.");
      }

      if (parsedCurrentPrice !== null && parsedCurrentPrice <= 0) {
        throw new Error("현재 가격은 0보다 큰 값이어야 합니다.");
      }

      if (alertType === "target_price" && parsedTargetPrice === null) {
        throw new Error("목표 가격 알림을 선택한 경우 목표 가격을 입력해주세요.");
      }

      const productResponse = await fetch("/api/products/parse-and-add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: url.trim(),
          manual_title: productTitle.trim(),
          manual_current_price: parsedCurrentPrice
        })
      });

      const productResult = (await productResponse.json()) as ProductResponse & {
        error?: string;
      };

      if (!productResponse.ok) {
        throw new Error(productResult.error ?? "상품 정보를 등록하지 못했습니다.");
      }

      setRegisteredProduct(productResult.product);

      if (productResult.product.title) {
        setProductTitle(productResult.product.title);
      }

      if (productResult.product.last_price !== null) {
        setCurrentPrice(String(productResult.product.last_price));
      }

      if (!productResult.product.id) {
        throw new Error("상품 등록 결과가 올바르지 않습니다. 다시 시도해주세요.");
      }

      const favoriteResponse = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_id: productResult.product.id,
          memo: memo.trim() || null
        })
      });

      const favoriteResult = (await favoriteResponse.json()) as FavoriteResponse & {
        error?: string;
      };

      if (!favoriteResponse.ok) {
        throw new Error(favoriteResult.error ?? "즐겨찾기 등록에 실패했습니다.");
      }

      const baselinePrice = productResult.product.last_price ?? parsedCurrentPrice;

      if (alertType !== "target_price" && baselinePrice === null) {
        throw new Error("등록 당시 가격 기준 알림을 위해 현재 가격이 필요합니다.");
      }

      const alertRuleResponse = await fetch("/api/alert-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_id: productResult.product.id,
          type: alertType,
          target_price: alertType === "target_price" ? parsedTargetPrice : null,
          baseline_price: alertType === "target_price" ? null : baselinePrice,
          active: true
        })
      });

      const alertRuleResult = (await alertRuleResponse.json()) as AlertRuleResponse & {
        error?: string;
      };

      if (!alertRuleResponse.ok) {
        throw new Error(alertRuleResult.error ?? "알림 조건 저장에 실패했습니다.");
      }

      setSuccess("상품과 알림 조건이 등록되었습니다. 대시보드 목록을 새로고침합니다.");
      setUrl("");
      setProductTitle("");
      setCurrentPrice("");
      setAlertType("price_drop");
      setTargetPrice("");
      setMemo("");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "상품 등록 중 알 수 없는 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-100">상품 추가</h3>
        <p className="mt-1 text-sm text-slate-400">
          URL을 넣고 자동 수집 버튼을 누르거나 직접 입력한 뒤 등록하세요. 상품명, URL,
          현재 가격은 필수입니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
          <label htmlFor="product-url" className="mb-1 block text-sm text-slate-200">
            상품 URL
          </label>
          <input
            id="product-url"
            type="url"
            required
            placeholder="https://smartstore.naver.com/... 또는 https://shopping.naver.com/..."
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          </div>
          <button
            type="button"
            onClick={handleFetchProductInfo}
            disabled={fetchingInfo || submitting}
            className="rounded-md border border-emerald-500/50 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fetchingInfo ? "수집 중..." : "상품명/가격 자동 수집"}
          </button>
        </div>

        <div>
          <label htmlFor="product-title" className="mb-1 block text-sm text-slate-200">
            상품명
          </label>
          <input
            id="product-title"
            type="text"
            maxLength={200}
              required
            placeholder="자동 수집되거나 직접 입력"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={productTitle}
            onChange={(event) => setProductTitle(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            자동 수집이 비어 있으면 직접 입력한 상품명으로 등록합니다.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="current-price" className="mb-1 block text-sm text-slate-200">
              현재 가격
            </label>
            <input
              id="current-price"
              type="number"
              min="0"
              step="1"
              required
              placeholder="자동 수집 또는 직접 입력"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={currentPrice}
              onChange={(event) => setCurrentPrice(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              등록 시에는 자동 수집을 다시 하지 않습니다. 지금 입력된 값으로만 저장합니다.
            </p>
          </div>

          <div>
            <label htmlFor="alert-type" className="mb-1 block text-sm text-slate-200">
              알림 조건
            </label>
            <select
              id="alert-type"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={alertType}
              onChange={(event) => setAlertType(event.target.value as AlertType)}
            >
              {ALERT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="target-price" className="mb-1 block text-sm text-slate-200">
            {alertType === "target_price" ? "목표 가격" : "등록 기준 가격"}
          </label>
          {alertType === "target_price" ? (
            <input
              id="target-price"
              type="number"
              min="0"
              step="1"
              placeholder="예: 99000"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
            />
          ) : (
            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
              등록 시점의 현재 가격을 기준가로 저장합니다.
              <p className="mt-1 text-xs text-slate-500">
                위 현재 가격 입력값이 필수이며, 그 값을 기준가로 사용합니다.
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="memo" className="mb-1 block text-sm text-slate-200">
            메모
          </label>
          <input
            id="memo"
            type="text"
            maxLength={100}
            placeholder="예: 세일 기다리는 상품"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>

        {registeredProduct && (
          <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
            <p className="font-medium text-slate-100">
              {(registeredProduct.title ?? productTitle) || "상품명은 아직 수집되지 않았습니다."}
            </p>
            <p className="mt-1 break-all text-slate-400">{registeredProduct.url}</p>
            <p className="mt-2 text-slate-300">
              현재 가격:{" "}
              {registeredProduct.last_price !== null
                ? `${registeredProduct.last_price.toLocaleString()}원`
                : "자동 수집 실패"}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        <button
          type="submit"
          disabled={fetchingInfo || submitting}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "등록 중..." : "상품 등록"}
        </button>
      </form>
    </div>
  );
}

