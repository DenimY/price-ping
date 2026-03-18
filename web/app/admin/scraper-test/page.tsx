import { redirect } from "next/navigation";
import { ScraperTestPanel } from "@/components/admin/ScraperTestPanel";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";

export default async function AdminScraperTestPage() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/auth/login");
  }

  if (!isAdminProfile(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">크롤링 테스트</h2>
        <p className="mt-1 text-sm text-slate-300">
          관리자 전용 테스트 페이지입니다. 현재 스케줄러가 사용할 가격 감지 로직이 실제로 어떤
          결과를 내는지 확인할 수 있습니다.
        </p>
      </div>

      <ScraperTestPanel />
    </div>
  );
}
