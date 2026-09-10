---
name: Expo web confirmations
description: Cross-platform confirmation and success navigation behavior in the Expo app.
---

Do not rely on React Native Alert button callbacks to perform required navigation or mutations in the web version.

**Why:** Native confirmation callbacks left cancellation, sign-in prompts, and post-submission navigation inactive in the Expo web app even though TypeScript passed.

**How to apply:** Provide a web-compatible confirmation or app dialog, retain native confirmation on mobile, and perform required success navigation directly rather than hiding it behind an unsupported alert callback. Verify both cancel and accept behavior without real payments or external messaging.