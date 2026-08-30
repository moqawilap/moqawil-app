---
name: Expo package targeting
description: How to add native Expo dependencies safely in this pnpm monorepo.
---

Add Expo-native dependencies to the mobile artifact package rather than the workspace root.

**Why:** Root-scoped package installation is rejected by pnpm's workspace-root guard and would assign the dependency to the wrong package even if forced.

**How to apply:** Update the mobile artifact's package dependencies and run a filtered workspace install, then run Expo's dependency compatibility check and restart the managed Expo workflow.