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
  taglineEn: "Oman's trusted marketplace",
  taglineAr: "سوق عُمان الموثوق",
  logoUrl: "",
  heroImageUrl: "",
  supportEmail: "",
  whatsappNumber: "",
};

export const DEFAULT_ADVERTISING_SETTINGS = {
  dailyPriceUsd: 6,
  usdToOmaniRial: 0.385,
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

export function normalizeAppearance(value: unknown) {
  return isAppearance(value) ? value : DEFAULT_APPEARANCE;
}

export function normalizeBranding(value: unknown) {
  return isBranding(value) ? value : DEFAULT_BRANDING;
}

export function normalizeAdvertisingSettings(value: unknown) {
  return isAdvertisingSettings(value) ? value : DEFAULT_ADVERTISING_SETTINGS;
}