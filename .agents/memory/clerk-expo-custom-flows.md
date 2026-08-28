---
name: Clerk Expo custom flows
description: Non-obvious API behavior for the installed Clerk Expo SDK.
---

Use the signal-based Clerk Expo custom flow API: `useSignIn()` and `useSignUp()` return `fetchStatus` plus future resources, not `isLoaded` or `setActive`. Complete flows with the resource's `finalize()` method, and use nested verification methods such as `signUp.verifications.sendEmailCode()` and `verifyEmailCode()`.

**Why:** The installed Clerk Expo SDK exposes the newer future-resource API, while older examples use the legacy resource shape and fail typechecking.

**How to apply:** Check the installed Clerk shared type definitions before copying custom auth examples, especially after dependency upgrades.