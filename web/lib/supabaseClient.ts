import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/env";

export function createBrowserClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();

  return createSupabaseBrowserClient(
    url,
    publishableKey
  );
}

