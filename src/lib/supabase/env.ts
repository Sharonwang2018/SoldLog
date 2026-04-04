/** Trim + strip trailing slashes so the REST client hits the correct origin. */
export function getSupabasePublicUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function getSupabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(getSupabasePublicUrl() && getSupabaseAnonKey());
}
