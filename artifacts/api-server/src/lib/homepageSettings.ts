export const HOMEPAGE_SECTION_IDS = ["services", "location", "providers", "properties", "maintenance"] as const;
export type HomepageSectionId = typeof HOMEPAGE_SECTION_IDS[number];
export type HomepageSectionSettings = {
  visible: boolean;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  detailEn: string;
  detailAr: string;
  actionEn: string;
  actionAr: string;
  limit: number;
};
export type HomepageSettings = {
  showSponsoredAds: boolean;
  hero: {
    visible: boolean;
    eyebrowEn: string;
    eyebrowAr: string;
    titleEn: string;
    titleAr: string;
    subtitleEn: string;
    subtitleAr: string;
    searchPlaceholderEn: string;
    searchPlaceholderAr: string;
  };
  sectionOrder: HomepageSectionId[];
  sections: Record<HomepageSectionId, HomepageSectionSettings>;
};

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  showSponsoredAds: true,
  hero: {
    visible: true,
    eyebrowEn: "INTEGRATED PROPERTY SERVICES",
    eyebrowAr: "منظومة متكاملة للخدمات العقارية",
    titleEn: "Complete solutions to build and manage your property.",
    titleAr: "حلول متكاملة لبناء وإدارة عقارك.",
    subtitleEn: "Connect with trusted contractors, consultants, and service providers across Oman.",
    subtitleAr: "نصل بك إلى نخبة المقاولين والاستشاريين ومقدمي الخدمات الموثوقين في سلطنة عُمان.",
    searchPlaceholderEn: "What do you need today?",
    searchPlaceholderAr: "ماذا تحتاج اليوم؟",
  },
  sectionOrder: [...HOMEPAGE_SECTION_IDS],
  sections: {
    services: { visible: true, titleEn: "What do you need?", titleAr: "ماذا تحتاج؟", subtitleEn: "Choose a service to get started", subtitleAr: "اختر خدمة للبدء", detailEn: "", detailAr: "", actionEn: "", actionAr: "", limit: 6 },
    location: { visible: true, titleEn: "OFFICIAL LOCAL DIRECTORY", titleAr: "الدليل المحلي الرسمي", subtitleEn: "Trusted services near {area}", subtitleAr: "خدمات موثوقة بالقرب من {area}", detailEn: "Verified professionals and selected services in {city}.", detailAr: "مزودون معتمدون وخدمات مختارة في {city}.", actionEn: "CURRENT LOCATION", actionAr: "الموقع الحالي", limit: 1 },
    providers: { visible: true, titleEn: "Recommended providers", titleAr: "مزودون موصى بهم", subtitleEn: "Trusted teams near you", subtitleAr: "قريبون منك في مسقط", detailEn: "", detailAr: "", actionEn: "View all", actionAr: "عرض الكل", limit: 2 },
    properties: { visible: true, titleEn: "Featured properties", titleAr: "عقارات مختارة", subtitleEn: "Places worth seeing", subtitleAr: "أماكن تستحق الزيارة", detailEn: "", detailAr: "", actionEn: "See all", actionAr: "كل العقارات", limit: 2 },
    maintenance: { visible: true, titleEn: "Quick maintenance", titleAr: "صيانة سريعة", subtitleEn: "Fix the small things before they grow", subtitleAr: "حل المشكلة قبل أن تكبر", detailEn: "", detailAr: "", actionEn: "", actionAr: "", limit: 4 },
  },
};

const homepageText = (value: unknown, fallback: string, maximum: number) => typeof value === "string" && value.length <= maximum ? value : fallback;
const homepageBoolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const homepageLimit = (value: unknown, fallback: number) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12 ? Number(value) : fallback;

export function normalizeHomepageSettings(value: unknown): HomepageSettings {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const heroInput = input.hero && typeof input.hero === "object" && !Array.isArray(input.hero) ? input.hero as Record<string, unknown> : {};
  const sectionInput = input.sections && typeof input.sections === "object" && !Array.isArray(input.sections) ? input.sections as Record<string, unknown> : {};
  const sections = Object.fromEntries(HOMEPAGE_SECTION_IDS.map((id) => {
    const fallback = DEFAULT_HOMEPAGE_SETTINGS.sections[id];
    const source = sectionInput[id] && typeof sectionInput[id] === "object" && !Array.isArray(sectionInput[id]) ? sectionInput[id] as Record<string, unknown> : {};
    return [id, {
      visible: homepageBoolean(source.visible, fallback.visible),
      titleEn: homepageText(source.titleEn, fallback.titleEn, 160),
      titleAr: homepageText(source.titleAr, fallback.titleAr, 160),
      subtitleEn: homepageText(source.subtitleEn, fallback.subtitleEn, 240),
      subtitleAr: homepageText(source.subtitleAr, fallback.subtitleAr, 240),
      detailEn: homepageText(source.detailEn, fallback.detailEn, 500),
      detailAr: homepageText(source.detailAr, fallback.detailAr, 500),
      actionEn: homepageText(source.actionEn, fallback.actionEn, 80),
      actionAr: homepageText(source.actionAr, fallback.actionAr, 80),
      limit: homepageLimit(source.limit, fallback.limit),
    }];
  })) as Record<HomepageSectionId, HomepageSectionSettings>;
  const requestedOrder = Array.isArray(input.sectionOrder) ? input.sectionOrder.filter((id): id is HomepageSectionId => typeof id === "string" && HOMEPAGE_SECTION_IDS.includes(id as HomepageSectionId)) : [];
  const sectionOrder = [...new Set(requestedOrder)];
  HOMEPAGE_SECTION_IDS.forEach((id) => { if (!sectionOrder.includes(id)) sectionOrder.push(id); });
  return {
    showSponsoredAds: homepageBoolean(input.showSponsoredAds, DEFAULT_HOMEPAGE_SETTINGS.showSponsoredAds),
    hero: {
      visible: homepageBoolean(heroInput.visible, DEFAULT_HOMEPAGE_SETTINGS.hero.visible),
      eyebrowEn: homepageText(heroInput.eyebrowEn, DEFAULT_HOMEPAGE_SETTINGS.hero.eyebrowEn, 120),
      eyebrowAr: homepageText(heroInput.eyebrowAr, DEFAULT_HOMEPAGE_SETTINGS.hero.eyebrowAr, 120),
      titleEn: homepageText(heroInput.titleEn, DEFAULT_HOMEPAGE_SETTINGS.hero.titleEn, 240),
      titleAr: homepageText(heroInput.titleAr, DEFAULT_HOMEPAGE_SETTINGS.hero.titleAr, 240),
      subtitleEn: homepageText(heroInput.subtitleEn, DEFAULT_HOMEPAGE_SETTINGS.hero.subtitleEn, 500),
      subtitleAr: homepageText(heroInput.subtitleAr, DEFAULT_HOMEPAGE_SETTINGS.hero.subtitleAr, 500),
      searchPlaceholderEn: homepageText(heroInput.searchPlaceholderEn, DEFAULT_HOMEPAGE_SETTINGS.hero.searchPlaceholderEn, 120),
      searchPlaceholderAr: homepageText(heroInput.searchPlaceholderAr, DEFAULT_HOMEPAGE_SETTINGS.hero.searchPlaceholderAr, 120),
    },
    sectionOrder,
    sections,
  };
}

export function isHomepageSettings(value: unknown): value is HomepageSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.showSponsoredAds !== "boolean" || !input.hero || typeof input.hero !== "object" || Array.isArray(input.hero) || !input.sections || typeof input.sections !== "object" || Array.isArray(input.sections)) return false;
  const hero = input.hero as Record<string, unknown>;
  const validText = (candidate: unknown, maximum: number) => typeof candidate === "string" && candidate.length <= maximum;
  if (typeof hero.visible !== "boolean"
    || !validText(hero.eyebrowEn, 120) || !validText(hero.eyebrowAr, 120)
    || !validText(hero.titleEn, 240) || !validText(hero.titleAr, 240)
    || !validText(hero.subtitleEn, 500) || !validText(hero.subtitleAr, 500)
    || !validText(hero.searchPlaceholderEn, 120) || !validText(hero.searchPlaceholderAr, 120)) return false;
  if (!Array.isArray(input.sectionOrder) || input.sectionOrder.length !== HOMEPAGE_SECTION_IDS.length
    || new Set(input.sectionOrder).size !== HOMEPAGE_SECTION_IDS.length
    || input.sectionOrder.some((id) => typeof id !== "string" || !HOMEPAGE_SECTION_IDS.includes(id as HomepageSectionId))) return false;
  const sections = input.sections as Record<string, unknown>;
  return HOMEPAGE_SECTION_IDS.every((id) => {
    const section = sections[id];
    if (!section || typeof section !== "object" || Array.isArray(section)) return false;
    const item = section as Record<string, unknown>;
    return typeof item.visible === "boolean"
      && validText(item.titleEn, 160) && validText(item.titleAr, 160)
      && validText(item.subtitleEn, 240) && validText(item.subtitleAr, 240)
      && validText(item.detailEn, 500) && validText(item.detailAr, 500)
      && validText(item.actionEn, 80) && validText(item.actionAr, 80)
      && Number.isInteger(item.limit) && Number(item.limit) >= 1 && Number(item.limit) <= 12;
  });
}