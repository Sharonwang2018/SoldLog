/**
 * Shared parsing of `sold_records.represented_side` (form + AI + poster). No LLM SDK deps — safe for client bundles.
 */
export type RepresentationRole = "buyer" | "seller" | "neutral" | "dual";

export function inferRepresentationRole(side: string | null | undefined): RepresentationRole {
  const t = (side ?? "").trim().toLowerCase();
  if (t === "both" || t.includes("dual") || t.includes("双方") || t.includes("双边")) {
    return "dual";
  }
  if (t === "buyer" || t.includes("buyer") || t.includes("买方")) return "buyer";
  if (t === "seller" || t.includes("seller") || t.includes("卖方")) return "seller";
  return "neutral";
}
