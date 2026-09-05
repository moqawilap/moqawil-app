export const DEFAULT_APPEARANCE = {
  primary: "#174A67",
  primaryForeground: "#FFFFFF",
  background: "#F6F4EF",
  foreground: "#102B43",
  card: "#FFFDFC",
  border: "#DCE1DF",
  accent: "#F4E7C8",
  primarySoft: "#E3EDF1",
  radius: 16,
};

export const DEFAULT_BRANDING = {
  appNameEn: "Moqawil",
  appNameAr: "مقاول",
  taglineEn: "One platform for all your building and property needs.",
  taglineAr: "منصة واحدة لكل احتياجات البناء والعقارات.",
  logoUrl: "",
  heroImageUrl: "",
  supportEmail: "",
  whatsappNumber: "",
};

export const DEFAULT_ADVERTISING_SETTINGS = {
  dailyPriceUsd: 6,
  usdToOmaniRial: 0.385,
};

export type CouponSetting = {
  id: string;
  code: string;
  discountType: "percent" | "fixed_usd";
  discountValue: number;
  scopes: Array<"service" | "real-estate" | "advertising">;
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
  enabled: boolean;
  approvalStatus: "draft" | "approved" | "rejected";
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const safeText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max;
const safeOptionalUrl = (value: unknown) => typeof value === "string" && (
  value.trim() === ""
  || /^https:\/\//i.test(value.trim())
  || /^data:image\/(png|jpe?g|webp);base64,/i.test(value.trim())
);

export function isAppearance(value: unknown): value is typeof DEFAULT_APPEARANCE {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["primary", "primaryForeground", "background", "foreground", "card", "border", "accent", "primarySoft"]
    .every((key) => typeof candidate[key] === "string" && HEX_COLOR.test(candidate[key]))
    && Number.isInteger(candidate.radius) && Number(candidate.radius) >= 6 && Number(candidate.radius) <= 28;
}

export function isBranding(value: unknown): value is typeof DEFAULT_BRANDING {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return safeText(candidate.appNameEn, 60)
    && safeText(candidate.appNameAr, 60)
    && safeText(candidate.taglineEn, 160)
    && safeText(candidate.taglineAr, 160)
    && safeText(candidate.supportEmail, 160)
    && safeText(candidate.whatsappNumber, 30)
    && safeOptionalUrl(candidate.logoUrl)
    && safeOptionalUrl(candidate.heroImageUrl);
}

export function isAdvertisingSettings(value: unknown): value is typeof DEFAULT_ADVERTISING_SETTINGS {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Number.isFinite(candidate.dailyPriceUsd)
    && Number(candidate.dailyPriceUsd) >= 0.5
    && Number(candidate.dailyPriceUsd) <= 1000
    && Number.isFinite(candidate.usdToOmaniRial)
    && Number(candidate.usdToOmaniRial) >= 0.001
    && Number(candidate.usdToOmaniRial) <= 10;
}

export function isCoupons(value: unknown): value is CouponSetting[] {
  if (!Array.isArray(value) || value.length > 200) return false;
  const codes = new Set<string>();
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const coupon = item as Record<string, unknown>;
    const code = String(coupon.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code) || codes.has(code)) return false;
    codes.add(code);
    return typeof coupon.id === "string" && coupon.id.length >= 8
      && ["percent", "fixed_usd"].includes(String(coupon.discountType))
      && Number.isFinite(coupon.discountValue) && Number(coupon.discountValue) > 0
      && (coupon.discountType !== "percent" || Number(coupon.discountValue) <= 100)
      && Array.isArray(coupon.scopes) && coupon.scopes.length > 0
      && coupon.scopes.every((scope) => ["service", "real-estate", "advertising"].includes(String(scope)))
      && typeof coupon.startsAt === "string" && Number.isFinite(Date.parse(coupon.startsAt))
      && typeof coupon.endsAt === "string" && Number.isFinite(Date.parse(coupon.endsAt))
      && Date.parse(coupon.endsAt) > Date.parse(coupon.startsAt)
      && (coupon.maxUses === null || (Number.isInteger(coupon.maxUses) && Number(coupon.maxUses) >= 1))
      && typeof coupon.enabled === "boolean"
      && ["draft", "approved", "rejected"].includes(String(coupon.approvalStatus));
  });
}

export function normalizeAppearance(value: unknown) {
  return isAppearance(value) ? value : DEFAULT_APPEARANCE;
}

export function normalizeBranding(value: unknown) {
  return isBranding(value) ? value : DEFAULT_BRANDING;
}

export function normalizeAdvertisingSettings(value: unknown) {
  return isAdvertisingSettings(value) ? value : DEFAULT_ADVERTISING_SETTINGS;
}