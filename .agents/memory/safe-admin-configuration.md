---
name: Safe admin configuration
description: Safety boundary for owner-editable appearance, content, pricing, and layout controls.
---

Admin customization must remain typed and allowlisted: semantic color tokens, bounded bilingual copy, approved images, authoritative prices, and ordering/visibility of known sections. Do not add arbitrary HTML, JavaScript, style objects, component names, or unrestricted page trees.

**Why:** The owner wants broad self-service control without developer help, but unrestricted design/code input could break navigation, accessibility, payment accuracy, or the entire application.

**How to apply:** Extend the existing validated configuration domains and fixed components. Keep financial values authoritative on the server, validate image URLs/data, and add new editable building blocks explicitly rather than exposing executable or structural code.