/** Must match buckets in Supabase (public vs private). */
export const STORAGE_BUCKETS = {
  /** Public listing photos — use getPublicUrl for browser + poster canvas. */
  propertyImages: "property-images",
  /** Private verification uploads — path `{userId}/{filename}`; no public URL in browser. */
  verificationDocs: "verification-docs",
} as const;
