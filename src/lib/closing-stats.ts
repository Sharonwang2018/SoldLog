import type { SupportedLocale } from "@/lib/i18n/locale";
import { intlDateLocale } from "@/lib/i18n/locale";

export type SoldRecordStatsRow = {
  price: number;
  city_state: string;
  closed_at: string | null;
  created_at: string;
};

export type CityAgg = {
  city_state: string;
  count: number;
  volume_usd: number;
};

export type ClosingStatsPayload = {
  startYmd: string;
  endYmd: string;
  from_month: string;
  to_month: string;
  count: number;
  total_volume_usd: number;
  by_city: CityAgg[];
};

/** YYYY-MM-DD from closed_at or created_at (UTC date portion). */
export function effectiveCloseYmd(row: Pick<SoldRecordStatsRow, "closed_at" | "created_at">): string {
  if (row.closed_at && /^\d{4}-\d{2}-\d{2}/.test(row.closed_at)) {
    return row.closed_at.slice(0, 10);
  }
  const c = row.created_at;
  if (c && c.length >= 10) return c.slice(0, 10);
  return "1970-01-01";
}

function monthTupleCompare(a: [number, number], b: [number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

/** Inclusive calendar range from first day of `fromMonth` through last day of `toMonth` (YYYY-MM). Swaps if reversed. */
export function monthStringsToInclusiveRange(
  fromMonth: string,
  toMonth: string,
): { startYmd: string; endYmd: string; from_month: string; to_month: string } | null {
  const parse = (s: string): [number, number] | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
    return [y, mo];
  };
  const a = parse(fromMonth);
  const b = parse(toMonth);
  if (!a || !b) return null;
  const [early, late] = monthTupleCompare(a, b) <= 0 ? [a, b] : [b, a];
  const from_month = `${early[0]}-${String(early[1]).padStart(2, "0")}`;
  const to_month = `${late[0]}-${String(late[1]).padStart(2, "0")}`;
  const startYmd = `${early[0]}-${String(early[1]).padStart(2, "0")}-01`;
  const lastD = new Date(late[0], late[1], 0).getDate();
  const endYmd = `${late[0]}-${String(late[1]).padStart(2, "0")}-${String(lastD).padStart(2, "0")}`;
  return { startYmd, endYmd, from_month, to_month };
}

export function aggregateClosingStats(
  rows: SoldRecordStatsRow[],
  startYmd: string,
  endYmd: string,
  meta: { from_month: string; to_month: string },
): ClosingStatsPayload {
  const filtered = rows.filter((r) => {
    const y = effectiveCloseYmd(r);
    return y >= startYmd && y <= endYmd;
  });

  const cityMap = new Map<string, { count: number; volume_usd: number }>();
  let total = 0;
  for (const r of filtered) {
    const p = Number(r.price);
    const safe = Number.isFinite(p) && p >= 0 ? p : 0;
    total += safe;
    const key = (r.city_state || "").trim() || "—";
    const cur = cityMap.get(key) ?? { count: 0, volume_usd: 0 };
    cur.count += 1;
    cur.volume_usd += safe;
    cityMap.set(key, cur);
  }

  const by_city: CityAgg[] = Array.from(cityMap.entries()).map(([city_state, v]) => ({
    city_state,
    count: v.count,
    volume_usd: v.volume_usd,
  }));
  by_city.sort((x, y) => {
    if (y.count !== x.count) return y.count - x.count;
    if (y.volume_usd !== x.volume_usd) return y.volume_usd - x.volume_usd;
    return x.city_state.localeCompare(y.city_state);
  });

  return {
    startYmd,
    endYmd,
    from_month: meta.from_month,
    to_month: meta.to_month,
    count: filtered.length,
    total_volume_usd: total,
    by_city,
  };
}

export function formatUsdCompact(n: number, locale: SupportedLocale): string {
  if (!Number.isFinite(n) || n < 0) return "$0";
  return new Intl.NumberFormat(intlDateLocale(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRangeLabel(startYmd: string, endYmd: string, locale: SupportedLocale): string {
  const loc = intlDateLocale(locale);
  const s = new Date(`${startYmd}T12:00:00Z`);
  const e = new Date(`${endYmd}T12:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  return `${s.toLocaleDateString(loc, opts)} – ${e.toLocaleDateString(loc, opts)}`;
}

function zhMonthHeading(ym: string): string {
  const [y, m] = ym.split("-");
  const mo = Number(m);
  if (!y || !Number.isFinite(mo)) return ym;
  return `${y}年${mo}月`;
}

/** Plain text for WeChat / paste; no markdown. */
export function buildClosingBriefShareText(
  stats: ClosingStatsPayload,
  locale: SupportedLocale,
  agentName: string,
): string {
  const name = agentName.trim();
  const range = formatRangeLabel(stats.startYmd, stats.endYmd, locale);
  const top = stats.by_city.slice(0, 5);

  if (stats.count === 0) {
    if (locale === "zh") {
      return `📊 成交简报\n统计区间：${range}\n\n所选时间内暂无成交记录。若房源已成交，可在每条 sold record 填写 Closing date，统计会更准确。`;
    }
    if (locale === "es") {
      return `📊 Resumen de cierres\nPeríodo: ${range}\n\nNo hay cierres en este rango. Añade la fecha de cierre en cada registro para mayor precisión.`;
    }
    if (locale === "ru") {
      return `📊 Сводка по сделкам\nПериод: ${range}\n\nНет сделок за выбранный период. Укажите дату закрытия в записях для точной статистики.`;
    }
    return `📊 Closing brief\nPeriod: ${range}\n\nNo closings in this range. Add a closing date on each sold record for more accurate stats.`;
  }

  const totalStr = formatUsdCompact(stats.total_volume_usd, locale);

  if (locale === "zh") {
    const intro = name ? `${name}｜` : "";
    const periodTitle =
      stats.from_month === stats.to_month
        ? zhMonthHeading(stats.from_month)
        : `${zhMonthHeading(stats.from_month)}–${zhMonthHeading(stats.to_month)}`;
    return `📊【成交简报】${intro}${periodTitle}\n统计区间：${range}\n\n✅ 成交套数：${stats.count}\n💰 成交总额：${totalStr}\n\n📍 主要区域：\n${top.map((c) => `· ${c.city_state}：${c.count} 套（${formatUsdCompact(c.volume_usd, locale)}）`).join("\n")}${stats.by_city.length > 5 ? "\n…" : ""}\n\n感谢客户信任，持续为大家安家置业助力。`;
  }

  if (locale === "es") {
    const intro = name ? `${name} · ` : "";
    return `📊 ${intro}Resumen de cierres\nPeríodo: ${range}\n\n✅ Cierres: ${stats.count}\n💰 Volumen total: ${totalStr}\n\n📍 Principales zonas:\n${top.map((c) => `· ${c.city_state}: ${c.count} (${formatUsdCompact(c.volume_usd, locale)})`).join("\n")}${stats.by_city.length > 5 ? "\n…" : ""}\n\nGracias a cada cliente por la confianza.`;
  }

  if (locale === "ru") {
    const intro = name ? `${name} · ` : "";
    return `📊 ${intro}Сводка\nПериод: ${range}\n\n✅ Сделок: ${stats.count}\n💰 Суммарный объём: ${totalStr}\n\n📍 Основные районы:\n${top.map((c) => `· ${c.city_state}: ${c.count} (${formatUsdCompact(c.volume_usd, locale)})`).join("\n")}${stats.by_city.length > 5 ? "\n…" : ""}\n\nСпасибо клиентам за доверие.`;
  }

  const intro = name ? `${name} — ` : "";
  return `📊 ${intro}Closing brief\nPeriod: ${range}\n\n✅ Closings: ${stats.count}\n💰 Total volume: ${totalStr}\n\n📍 Top markets:\n${top.map((c) => `· ${c.city_state}: ${c.count} (${formatUsdCompact(c.volume_usd, locale)})`).join("\n")}${stats.by_city.length > 5 ? "\n…" : ""}\n\nThank you to every client for your trust.`;
}
