---
name: Resend test sender restrictions
description: Delivery limits that apply while Moqawil uses Resend's onboarding sender.
---

While the sender remains `onboarding@resend.dev`, send administrative notifications only to the email address that owns the connected Resend account. Resend rejects the entire request if other recipients are included.

**Why:** Resend test mode returned validation errors for other real administrators and synthetic test accounts, but accepted delivery to the connection owner's address. Sending one invalid recipient causes every recipient in that request to miss the notification.

**How to apply:** Keep test-mode delivery restricted to the connection owner. Once a verified domain and matching sender are configured, allow delivery to all active administrator email addresses and retain filtering for reserved test domains.