---
name: Marketplace image galleries
description: Compatibility rule for multi-image managed profiles and property listings.
---

Managed contractor, workshop, designer, maintenance-provider, and property records may retain up to 15 images. The first image is also written to the legacy single-image field as the cover.

**Why:** Existing customer views and older API clients still read one cover image, while administrators need true multi-image selection and persistence.

**How to apply:** Keep gallery order stable, treat index zero as the cover, and update the legacy field whenever images are added, removed, or reordered.