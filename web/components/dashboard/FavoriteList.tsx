"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMallDisplayInfo } from "@/lib/mall";

type AlertType = "target_price" | "price_drop" | "price_change";

const ALERT_TYPE_OPTIONS: Array<{ value: AlertType; label: string }> = [
  { value: "price_drop", label: "등록 당시 가격보다 하락" },
  { value: "price_change", label: "등록 당시 가격에서 변동" },
  { value: "target_price", label: "목표 가격 도달" },
];

function getAlertTypeLabel(type: AlertType) {
  return ALERT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "등록 당시 가격보다 하락";
}

export type DashboardFavoriteItem = {
  favoriteId: number;
  productId: number | null;
  mall: string | null;
  title: string | null;
  imageUrl: string | null;
  url: string | null;
  lastPrice: number | null;
  memo: string | null;
  alertType: AlertType;
  targetPrice: number | null;
  baselinePrice: number | null;
  alertActive: boolean;
};

type FavoriteListProps = {
  items: DashboardFavoriteItem[];
};

type FavoriteCardProps = {
  item: DashboardFavoriteItem;
};

function FavoriteCard({ item }: FavoriteCardProps) {
  const router = useRouter();
  const mallInfo = getMallDisplayInfo(item.mall);
  const [memo, setMemo] = useState(item.memo ?? "");
  const [alertType, setAlertType] = useState<AlertType>(item.alertType);
  const [targetPrice, setTargetPrice] = useState(
    item.targetPrice !== null ? String(item.targetPrice) : ""
  );
  const [alertActive, setAlertActive] = useState(item.alertActive);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave() {
    if (!item.productId) {
      setError("상품 정보가 올바르지 않아 수정할 수 없습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedTargetPrice = targetPrice.trim() ? Number(targetPrice) : null;
      const baselinePrice = item.baselinePrice ?? item.lastPrice;

      if (parsedTargetPrice !== null && (Number.isNaN(parsedTargetPrice) || parsedTargetPrice <= 0)) {
        throw new Error("목표 가격은 0보다 큰 숫자여야 합니다.");
      }

      if (alertType === "target_price" && parsedTargetPrice === null) {
        throw new Error("목표 가격 알림을 선택한 경우 목표 가격을 입력해주세요.");
      }

      if (alertType !== "target_price" && baselinePrice === null) {
        throw new Error("현재 가격이 없어 등록 당시 기준 가격 알림을 저장할 수 없습니다.");
      }

      const favoriteResponse = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_id: item.productId,
          memo: memo.trim() || null
        })
      });

      const favoriteResult = (await favoriteResponse.json()) as { error?: string };

      if (!favoriteResponse.ok) {
        throw new Error(favoriteResult.error ?? "즐겨찾기 수정에 실패했습니다.");
      }

      const alertResponse = await fetch("/api/alert-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_id: item.productId,
          type: alertType,
          target_price: alertType === "target_price" ? parsedTargetPrice : null,
          baseline_price: alertType === "target_price" ? null : baselinePrice,
          active: alertActive
        })
      });

      const alertResult = (await alertResponse.json()) as { error?: string };

      if (!alertResponse.ok) {
        throw new Error(alertResult.error ?? "알림 규칙 저장에 실패했습니다.");
      }

      setSuccess("변경사항을 저장했습니다.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "변경사항 저장 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/favorites/${item.favoriteId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({ error: "삭제에 실패했습니다." }))) as {
          error?: string;
        };
        throw new Error(result.error ?? "삭제에 실패했습니다.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${mallInfo.className}`}>
              {mallInfo.shortLabel}
            </span>
            <span className="text-xs text-slate-400">{mallInfo.label}</span>
          </div>
          <p className="text-base font-medium text-slate-100">{item.title ?? "상품명 없음"}</p>
          <a
            href={item.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-sm text-slate-400 underline-offset-2 hover:underline"
          >
            {item.url ? "상품 페이지 열기 ->" : "-"}
          </a>
        </div>
        <button
          type="button"
          onClick={() => setAlertActive((prev) => !prev)}
          disabled={loading || deleting}
          aria-pressed={alertActive}
          className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
            alertActive
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-300"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          알림 {alertActive ? "ON" : "OFF"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <p>현재 가격: {item.lastPrice?.toLocaleString() ?? "-"}원</p>
        <p>현재 알림 조건: {getAlertTypeLabel(item.alertType)}</p>
        {item.alertType === "target_price" ? (
          <p>기존 목표 가격: {item.targetPrice?.toLocaleString() ?? "-"}원</p>
        ) : (
          <p>등록 기준가: {item.baselinePrice?.toLocaleString() ?? "-"}원</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-200">메모</label>
          <input
            type="text"
            maxLength={100}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-200">알림 조건</label>
          <select
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

      <div className="mt-4">
        <label className="mb-1 block text-sm text-slate-200">
          {alertType === "target_price" ? "목표 가격" : "기준 가격"}
        </label>
        {alertType === "target_price" ? (
          <input
            type="number"
            min="0"
            step="1"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
          />
        ) : (
          <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
            {(
              item.baselinePrice ??
              item.lastPrice ??
              null
            )?.toLocaleString() ?? "-"}
            원
            <p className="mt-1 text-xs text-slate-500">
              저장 시 현재 가격을 등록 기준가로 사용합니다.
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-400">{success}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || deleting}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "저장 중..." : "변경 저장"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading || deleting}
          className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "삭제 중..." : "삭제"}
        </button>
      </div>
    </div>
  );
}

export function FavoriteList({ items }: FavoriteListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
        아직 등록된 관심 상품이 없습니다. 왼쪽 폼에서 네이버 스마트스토어,
        네이버플러스 스토어, 쿠팡 URL과 알림 조건을 입력해 첫 상품을 등록해보세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FavoriteCard key={item.favoriteId} item={item} />
      ))}
    </div>
  );
}

