import type { SupportedLocale } from "@/lib/i18n/locale";

export type SoldStoryCopy = {
  soldFor: string;
  daysOnMarket: string;
  theStory: string;
  listedBy: (agentName: string) => string;
  closed: (formattedDate: string) => string;
  storyFallback: string;
  viewAllSales: string;
  generatePoster: string;
  creatingPoster: string;
};

const COPY: Record<SupportedLocale, SoldStoryCopy> = {
  en: {
    soldFor: "Sold for",
    daysOnMarket: "Days on market",
    theStory: "The story",
    listedBy: (name) => `Listed by ${name}`,
    closed: (d) => `Closed ${d}`,
    storyFallback:
      "Success story details will appear here — tailored for social sharing. Images are served as WebP/AVIF when supported for faster mobile loads.",
    viewAllSales: "View all sales",
    generatePoster: "Generate poster",
    creatingPoster: "Creating poster…",
  },
  zh: {
    soldFor: "成交价",
    daysOnMarket: "挂牌天数",
    theStory: "成交故事",
    listedBy: (name) => `挂牌经纪人 · ${name}`,
    closed: (d) => `成交日期 ${d}`,
    storyFallback: "成交故事将展示在这里，适合朋友圈与小红书分享。",
    viewAllSales: "查看全部成交",
    generatePoster: "生成分享海报",
    creatingPoster: "正在生成海报…",
  },
  ru: {
    soldFor: "Цена продажи",
    daysOnMarket: "Дней на рынке",
    theStory: "История сделки",
    listedBy: (name) => `Агент: ${name}`,
    closed: (d) => `Закрыто ${d}`,
    storyFallback: "Здесь появится история сделки — удобно для соцсетей.",
    viewAllSales: "Все сделки",
    generatePoster: "Создать постер",
    creatingPoster: "Создание постера…",
  },
  es: {
    soldFor: "Precio de venta",
    daysOnMarket: "Días en el mercado",
    theStory: "La historia",
    listedBy: (name) => `Listado por ${name}`,
    closed: (d) => `Cerrado ${d}`,
    storyFallback: "Aquí aparecerá la historia de la venta, pensada para compartir en redes.",
    viewAllSales: "Ver todas las ventas",
    generatePoster: "Generar póster",
    creatingPoster: "Generando póster…",
  },
};

export function soldStoryStrings(locale: SupportedLocale): SoldStoryCopy {
  return COPY[locale] ?? COPY.en;
}

export function posterFontFamily(locale: SupportedLocale): string {
  if (locale === "zh") {
    return '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  }
  if (locale === "ru" || locale === "es") {
    return '"Noto Sans", ui-sans-serif, system-ui, sans-serif';
  }
  return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
}

export function posterWordmarkFontFamily(locale: SupportedLocale): string {
  if (locale === "zh") {
    return '"Noto Sans SC", "PingFang SC", sans-serif';
  }
  return 'Georgia, "Times New Roman", serif';
}
