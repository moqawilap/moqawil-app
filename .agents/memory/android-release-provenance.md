---
name: Android release provenance
description: Existing Play release came from PWABuilder, not Expo; preserve signing continuity.
---

The user states the existing Google Play Internal Testing AAB was generated with PWABuilder, not Expo/EAS. They authorize a new Expo project for the existing application, but not a new Play listing or signing key.

**Why:** Searching for an existing EAS build association is the wrong prerequisite. Signing continuity must instead be established against the prior PWABuilder upload certificate.

**How to apply:** Treat the existing Play identity and credentials as authoritative. Obtain confirmation of access to the old keystore through secure tooling; never infer that an absent local key authorizes generating one.