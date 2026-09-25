---
name: Expo dashboard versus EAS CLI login
description: Expo dashboard integrations and the local EAS CLI use separate authentication.
---

Connecting a repository in Expo or using the Expo integration does not authenticate the workspace's `eas` command-line tool.

**Why:** EAS configuration commands require an Expo user session and can stop at the login prompt even when the repository is already connected in the Expo dashboard.

**How to apply:** Check `eas whoami` before CLI configuration. If it is not signed in, ask the user to complete `eas login` privately in the Shell rather than requesting a password or token in chat. Do not interpret a successful dashboard connection as proof that CLI configuration finished.