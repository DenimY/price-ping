import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

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
    .select("id, email, full_name, nickname, phone_number, privacy_consent, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json(
    profile ?? {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata.full_name ?? null,
      nickname: null,
      phone_number: user.user_metadata.phone_number ?? null,
      privacy_consent: Boolean(user.user_metadata.privacy_consent),
      role: "user",
      created_at: user.created_at
    }
  );
}

