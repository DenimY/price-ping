import { redirect } from "next/navigation";
import { UserApprovalTable, type AdminUserRow } from "@/components/admin/UserApprovalTable";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";

function mapAdminUserRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: typeof row.id === "string" ? row.id : "",
    email: typeof row.email === "string" ? row.email : null,
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    nickname: typeof row.nickname === "string" ? row.nickname : null,
    phone_number: typeof row.phone_number === "string" ? row.phone_number : null,
    role: row.role === "admin" ? "admin" : "user",
    approval_status:
      row.approval_status === "approved" || row.approval_status === "rejected"
        ? row.approval_status
        : "pending",
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString()
  };
}

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
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">유저관리</h2>
        <p className="text-sm text-red-400">회원 목록을 불러오지 못했습니다: {error.message}</p>
      </div>
    );
  }

  const users = ((data ?? []) as Array<Record<string, unknown>>).map(mapAdminUserRow).sort((a, b) => {
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
