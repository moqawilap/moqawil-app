---
name: Clerk Expo custom flows
description: Non-obvious API behavior for the installed Clerk Expo SDK.
---

Use the signal-based Clerk Expo custom flow API: `useSignIn()` and `useSignUp()` return `fetchStatus` plus future resources, not `isLoaded` or `setActive`. Complete flows with the resource's `finalize()` method, and use nested verification methods such as `signUp.verifications.sendEmailCode()` and `verifyEmailCode()`.

**Why:** The installed Clerk Expo SDK exposes the newer future-resource API, while older examples use the legacy resource shape and fail typechecking.

**How to apply:** Check the installed Clerk shared type definitions before copying custom auth examples, especially after dependency upgrades.

The Expo auth flow should keep Clerk's `tokenCache` enabled at the provider and redirect signed-in users away from auth routes. Existing-email signup attempts should go to sign-in rather than create a second account.

**Why:** Users confirmed that this preserves the session across app launches and prevents repeat registration.

**How to apply:** Keep this behavior when changing the custom sign-in/sign-up screens; only an explicit sign-out or cleared app data should return a user to authentication.