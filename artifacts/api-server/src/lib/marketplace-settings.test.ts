import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  HOMEPAGE_SECTION_IDS,
  isHomepageSettings,
  normalizeHomepageSettings,
} from "./homepageSettings.ts";

const validHomepage = () => structuredClone(DEFAULT_HOMEPAGE_SETTINGS);

test("homepage settings validation ignores JSON property order", () => {
  const source = validHomepage();
  const reordered = {
    sections: Object.fromEntries([...HOMEPAGE_SECTION_IDS].reverse().map((id) => [id, {
      limit: source.sections[id].limit,
      actionAr: source.sections[id].actionAr,
      actionEn: source.sections[id].actionEn,
      detailAr: source.sections[id].detailAr,
      detailEn: source.sections[id].detailEn,
      subtitleAr: source.sections[id].subtitleAr,
      subtitleEn: source.sections[id].subtitleEn,
      titleAr: source.sections[id].titleAr,
      titleEn: source.sections[id].titleEn,
      visible: source.sections[id].visible,
    }])),
    sectionOrder: source.sectionOrder,
    hero: {
      searchPlaceholderAr: source.hero.searchPlaceholderAr,
      searchPlaceholderEn: source.hero.searchPlaceholderEn,
      subtitleAr: source.hero.subtitleAr,
      subtitleEn: source.hero.subtitleEn,
      titleAr: source.hero.titleAr,
      titleEn: source.hero.titleEn,
      eyebrowAr: source.hero.eyebrowAr,
      eyebrowEn: source.hero.eyebrowEn,
      visible: source.hero.visible,
    },
    showSponsoredAds: source.showSponsoredAds,
  };
  assert.equal(isHomepageSettings(reordered), true);
});

test("homepage settings validation rejects incomplete or duplicate section orders", () => {
  const missing = validHomepage();
  missing.sectionOrder = missing.sectionOrder.slice(0, -1);
  assert.equal(isHomepageSettings(missing), false);

  const duplicate = validHomepage();
  duplicate.sectionOrder = ["services", "services", "providers", "properties", "maintenance"];
  assert.equal(isHomepageSettings(duplicate), false);
});

test("normalization restores safe defaults for malformed persisted values", () => {
  const normalized = normalizeHomepageSettings({
    showSponsoredAds: "yes",
    sectionOrder: ["providers", "unknown", "providers"],
    sections: { providers: { limit: 99, visible: "yes" } },
  });
  assert.equal(normalized.showSponsoredAds, true);
  assert.equal(normalized.sectionOrder[0], "providers");
  assert.equal(new Set(normalized.sectionOrder).size, HOMEPAGE_SECTION_IDS.length);
  assert.equal(normalized.sections.providers.limit, DEFAULT_HOMEPAGE_SETTINGS.sections.providers.limit);
  assert.equal(normalized.sections.providers.visible, true);
});