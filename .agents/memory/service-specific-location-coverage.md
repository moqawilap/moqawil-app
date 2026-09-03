---
name: Service-specific location coverage
description: Where multi-wilayat and all-Oman coverage should live and how public location matching should use it.
---

Store multi-wilayat coverage and the all-Oman flag on each service rather than only on the provider profile. Public contractor search must combine category/specialty and location in the same service match.

**Why:** A provider may offer different services in different parts of Oman. Profile-level coverage would incorrectly make every specialty appear available in every area served by any one service.

**How to apply:** When approving or editing a service, persist its selected wilayats and all-Oman state. For location searches, match the requested category/specialty against a service that also covers the requested wilayat; retain singular profile location only as legacy fallback.