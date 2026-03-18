import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, isAdminProfile } from "@/lib/accessControl";

type ApprovalStatus = "pending" | "approved" | "rejected";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminProfile(profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    approval_status?: ApprovalStatus;
  };

  if (!body.approval_status || !["pending", "approved", "rejected"].includes(body.approval_status)) {
    return NextResponse.json({ error: "유효한 approval_status가 필요합니다." }, { status: 400 });
  }

  if (params.id === user.id && body.approval_status !== "approved") {
    return NextResponse.json(
      { error: "관리자 본인 계정은 승인 완료 상태를 유지해야 합니다." },
      { status: 400 }
    );
  }

  const payload =
    body.approval_status === "approved"
      ? {
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          updated_at: new Date().toISOString()
        }
      : {
          approval_status: body.approval_status,
          approved_at: null,
          approved_by: null,
          updated_at: new Date().toISOString()
        };

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", params.id)
    .select("id, email, role, approval_status, approved_at, approved_by")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
