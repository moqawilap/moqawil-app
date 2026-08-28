---
name: Clerk role regression tests
description: The source of truth for marketplace roles during Clerk permission tests.
---

The API treats the Clerk user's actual public metadata as authoritative for marketplace roles. Token-claim overrides do not replace metadata fetched through the Clerk backend API.

**Why:** The server fetches the current Clerk user record on authenticated requests, so session claims can be stale or overridden without changing effective authorization.

**How to apply:** Set actual Clerk public metadata for stable role identities. Use disposable identities for role-revocation checks so repeated runs do not mutate shared fixtures.