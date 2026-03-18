import { createServerSupabaseClient } from "@/lib/supabaseServer";

export type AppRole = "user" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CurrentProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  nickname: string | null;
  phone_number: string | null;
  privacy_consent: boolean;
  kakao_alert_consent: boolean;
  kakao_alert_consent_at: string | null;
  role: AppRole;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
};

type UserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

function pickString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toRole(value: unknown): AppRole {
  return value === "admin" ? "admin" : "user";
}

function toApprovalStatus(value: unknown): ApprovalStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

export function buildCurrentProfile(
  user: UserLike,
  rawProfile: Partial<CurrentProfile> | null | undefined
): CurrentProfile {
  const metadata = user.user_metadata ?? {};

  return {
    id: pickString(rawProfile?.id) ?? user.id,
    email: pickString(rawProfile?.email) ?? pickString(user.email) ?? null,
    full_name: pickString(rawProfile?.full_name) ?? pickString(metadata.full_name) ?? null,
    nickname: pickString(rawProfile?.nickname) ?? pickString(metadata.nickname) ?? null,
    phone_number: pickString(rawProfile?.phone_number) ?? pickString(metadata.phone_number) ?? null,
    privacy_consent: pickBoolean(
      rawProfile?.privacy_consent,
      pickBoolean(metadata.privacy_consent, false)
    ),
    kakao_alert_consent: pickBoolean(
      rawProfile?.kakao_alert_consent,
      pickBoolean(metadata.kakao_alert_consent, false)
    ),
    kakao_alert_consent_at:
      pickString(rawProfile?.kakao_alert_consent_at) ??
      pickString(metadata.kakao_alert_consent_at) ??
      null,
    role: toRole(rawProfile?.role),
    approval_status: toApprovalStatus(rawProfile?.approval_status),
    approved_at: pickString(rawProfile?.approved_at) ?? null,
    approved_by: pickString(rawProfile?.approved_by) ?? null
  };
}

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
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    supabase,
    user,
    profile: buildCurrentProfile(user, (profile ?? null) as Partial<CurrentProfile> | null)
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
