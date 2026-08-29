---
name: OpenAPI counter compatibility
description: Compatibility rule for generated Zod validators on numeric API counters.
---

Use `type: number` rather than `type: integer` for non-negative API counters while this workspace remains on its current Zod major version.

**Why:** The OpenAPI generator emits `z.int()` for integer schemas, but the installed Zod runtime does not provide that helper, causing generated-library type checks to fail.

**How to apply:** Keep runtime integer validation in the API handler or upgrade Zod and verify generated consumers before restoring integer schemas.