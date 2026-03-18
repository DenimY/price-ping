"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApprovalStatus = "pending" | "approved" | "rejected";

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  nickname: string | null;
  phone_number: string | null;
  role: "user" | "admin";
  approval_status: ApprovalStatus;
  approved_at: string | null;
  created_at: string;
};

type UserApprovalTableProps = {
  users: AdminUserRow[];
};

function getApprovalStatusLabel(status: ApprovalStatus) {
  switch (status) {
    case "approved":
      return "승인 완료";
    case "rejected":
      return "반려";
    default:
      return "승인 대기";
  }
}

function getApprovalStatusClassName(status: ApprovalStatus) {
  switch (status) {
    case "approved":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "rejected":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  }
}

export function UserApprovalTable({ users }: UserApprovalTableProps) {
  const router = useRouter();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function updateApprovalStatus(userId: string, approvalStatus: ApprovalStatus) {
    setLoadingUserId(userId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          approval_status: approvalStatus
        })
      });

      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "회원 승인 상태를 변경하지 못했습니다.");
      }

      setSuccess(
        approvalStatus === "approved"
          ? "선택한 회원을 승인했습니다."
          : "선택한 회원을 반려 상태로 변경했습니다."
      );
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "회원 승인 상태 변경 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingUserId(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
        관리할 회원이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <div className="space-y-3">
        {users.map((user) => {
          const isLoading = loadingUserId === user.id;

          return (
            <div
              key={user.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-medium text-slate-100">
                    {user.full_name || user.nickname || user.email || "이름 없음"}
                  </p>
                  <p className="text-sm text-slate-400">{user.email ?? "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${getApprovalStatusClassName(
                      user.approval_status
                    )}`}
                  >
                    {getApprovalStatusLabel(user.approval_status)}
                  </span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                    {user.role === "admin" ? "관리자" : "일반 회원"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p>닉네임: {user.nickname ?? "-"}</p>
                <p>전화번호: {user.phone_number ?? "-"}</p>
                <p>가입일: {new Date(user.created_at).toLocaleString("ko-KR")}</p>
                <p>
                  승인일: {user.approved_at ? new Date(user.approved_at).toLocaleString("ko-KR") : "-"}
                </p>
              </div>

              {user.role !== "admin" && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => updateApprovalStatus(user.id, "approved")}
                    disabled={isLoading}
                    className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading && loadingUserId === user.id ? "처리 중..." : "승인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateApprovalStatus(user.id, "rejected")}
                    disabled={isLoading}
                    className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading && loadingUserId === user.id ? "처리 중..." : "반려"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
