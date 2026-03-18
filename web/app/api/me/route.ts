import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { buildCurrentProfile } from "@/lib/accessControl";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const resolvedProfile = buildCurrentProfile(
    {
      id: user.id,
      email: user.email ?? null,
      user_metadata: user.user_metadata as Record<string, unknown>
    },
    (profile ?? null) as Record<string, unknown>
  );

  return NextResponse.json({
    ...resolvedProfile,
    created_at:
      profile && typeof profile.created_at === "string" && profile.created_at.length > 0
        ? profile.created_at
        : user.created_at
  });
}

