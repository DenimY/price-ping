import { redirect } from "next/navigation";
import { UserApprovalTable, type AdminUserRow } from "@/components/admin/UserApprovalTable";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";

export default async function AdminUsersPage() {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/auth/login");
  }

  if (!isAdminProfile(profile)) {
    redirect("/dashboard");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, nickname, phone_number, role, approval_status, approved_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">유저관리</h2>
        <p className="text-sm text-red-400">회원 목록을 불러오지 못했습니다: {error.message}</p>
      </div>
    );
  }

  const users = ((data ?? []) as AdminUserRow[]).sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === "admin" ? -1 : 1;
    }

    if (a.approval_status !== b.approval_status) {
      return a.approval_status === "pending" ? -1 : 1;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">유저관리</h2>
        <p className="mt-1 text-sm text-slate-300">
          신규 가입 회원의 승인 상태를 관리합니다. 승인된 회원만 일반 사용자 기능을 이용할 수
          있습니다.
        </p>
      </div>

      <UserApprovalTable users={users} />
    </div>
  );
}
