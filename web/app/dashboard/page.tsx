import { redirect } from "next/navigation";
import { AddProductForm } from "@/components/dashboard/AddProductForm";
import { FavoriteList, type DashboardFavoriteItem } from "@/components/dashboard/FavoriteList";
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

export default async function DashboardPage() {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/auth/login");
  }

  if (!isApprovedProfile(profile)) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-xl font-semibold text-amber-200">승인 대기 중입니다</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/90">
          회원가입은 완료되었지만 관리자 승인 전이라 아직 상품 등록과 가격 추적 기능을 사용할 수
          없습니다. 승인 후 다시 로그인하면 바로 대시보드를 이용할 수 있습니다.
        </p>
        <p className="mt-3 text-sm text-slate-300">
          현재 계정: {(profile?.nickname ?? user.email) || "사용자"}
        </p>
      </div>
    );
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
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">내 관심 상품</h2>
        <p className="text-sm text-red-400">
          즐겨찾기 목록을 불러오지 못했습니다: {error.message}
        </p>
      </div>
    );
  }

  const favoriteRows = (favorites ?? []) as unknown as FavoriteRow[];
  const productIds = favoriteRows
    .map((favorite) => getFavoriteProduct(favorite)?.id)
    .filter((id): id is number => typeof id === "number");

  const alertMap = new Map<number, AlertRuleSummary>();

  if (productIds.length > 0) {
    const { data: alertRules } = await supabase
      .from("alert_rules")
      .select("product_id, type, target_price, baseline_price, active")
      .eq("user_id", user.id)
      .in("product_id", productIds);

    for (const rule of (alertRules ?? []) as AlertRuleRow[]) {
      alertMap.set(rule.product_id, {
        type: rule.type,
        target_price: rule.target_price,
        baseline_price: rule.baseline_price,
        active: rule.active
      });
    }
  }

  const items: DashboardFavoriteItem[] = favoriteRows.map((favorite) => {
    const product = getFavoriteProduct(favorite);
    const alert = product ? alertMap.get(product.id) : null;

    return {
      favoriteId: favorite.id,
      productId: product?.id ?? null,
      mall: product?.mall ?? null,
      title: product?.title ?? null,
      imageUrl: product?.image_url ?? null,
      url: product?.url ?? null,
      lastPrice: product?.last_price ?? null,
      memo: favorite.memo,
      alertType: alert?.type ?? "price_drop",
      targetPrice: alert?.target_price ?? null,
      baselinePrice: alert?.baseline_price ?? null,
      alertActive: alert?.active ?? false
    };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">내 관심 상품</h2>
      <p className="text-sm text-slate-300">
        {(profile?.nickname ?? user.email) || "사용자"}님, 등록한 상품의 현재 가격과 알림
        조건을 여기서 확인할 수 있습니다.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div>
          <AddProductForm />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">등록된 상품</h3>
            <span className="text-sm text-slate-400">{favoriteRows.length}개</span>
          </div>
          <FavoriteList items={items} />
        </div>
      </div>
    </div>
  );
}

