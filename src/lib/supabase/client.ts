import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabasePublicUrl, isSupabaseServerConfigured } from "@/lib/supabase/env";

export function createBrowserSupabaseClient() {
  const url = getSupabasePublicUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured(): boolean {
  return isSupabaseServerConfigured();
}
