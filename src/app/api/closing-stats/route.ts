/**
 * GET /api/closing-stats?from=YYYY-MM&to=YYYY-MM — aggregate signed-in agent's sold_records for marketing brief.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/env";
import {
  aggregateClosingStats,
  monthStringsToInclusiveRange,
  type SoldRecordStatsRow,
} from "@/lib/closing-stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const fromMonth = (searchParams.get("from") ?? "").trim();
  const toMonth = (searchParams.get("to") ?? "").trim();

  const bounds = monthStringsToInclusiveRange(fromMonth, toMonth);
  if (!bounds) {
    return NextResponse.json(
      { error: "Provide valid from and to as YYYY-MM (e.g. from=2026-01&to=2026-03)." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("sold_records")
    .select("price, city_state, closed_at, created_at")
    .eq("agent_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  const normalized: SoldRecordStatsRow[] = (rows ?? []).map((r) => ({
    price: typeof r.price === "number" ? r.price : Number(r.price),
    city_state: String(r.city_state ?? ""),
    closed_at: r.closed_at != null ? String(r.closed_at) : null,
    created_at: String(r.created_at ?? ""),
  }));

  const stats = aggregateClosingStats(normalized, bounds.startYmd, bounds.endYmd, {
    from_month: bounds.from_month,
    to_month: bounds.to_month,
  });

  return NextResponse.json({ ok: true, ...stats });
}
