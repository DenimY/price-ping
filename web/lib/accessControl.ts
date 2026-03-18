import { createServerSupabaseClient } from "@/lib/supabaseServer";

export type AppRole = "user" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CurrentProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  nickname: string | null;
  phone_number: string | null;
  role: AppRole;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
};

export async function getCurrentUserProfile() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      profile: null
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, nickname, phone_number, role, approval_status, approved_at, approved_by"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    supabase,
    user,
    profile: (profile ?? {
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata.full_name as string | undefined) ?? null,
      nickname: (user.user_metadata.nickname as string | undefined) ?? null,
      phone_number: (user.user_metadata.phone_number as string | undefined) ?? null,
      role: "user",
      approval_status: "pending",
      approved_at: null,
      approved_by: null
    }) as CurrentProfile
  };
}

export function isAdminProfile(profile: Pick<CurrentProfile, "role"> | null | undefined) {
  return profile?.role === "admin";
}

export function isApprovedProfile(
  profile: Pick<CurrentProfile, "role" | "approval_status"> | null | undefined
) {
  if (!profile) {
    return false;
  }

  return profile.role === "admin" || profile.approval_status === "approved";
}
