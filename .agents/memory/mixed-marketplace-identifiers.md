---
name: Mixed marketplace identifiers
description: Why marketplace interaction APIs must accept both catalog slugs and database UUIDs.
---

The visible marketplace combines built-in catalog entries identified by stable slugs with database-managed entries, including contractor profiles identified by UUIDs. User-facing interactions that apply to every visible item must not assume UUID-only identifiers.

**Why:** UUID-only rating lookups caused valid built-in properties and providers to fail even though they were rendered as normal marketplace items.

**How to apply:** For shared interaction data such as ratings, use a typed subject identifier that can store either form. Validate UUIDs before querying UUID database columns, and expose aggregate reads independently from full managed-record detail endpoints.