---
name: GitHub connector versus Git push
description: The GitHub API connector and workspace Git transport can have separate authorization.
---

An authorized GitHub integration can read and write through its API proxy while Git's HTTPS push still has no valid credentials. Do not assume that connecting the integration makes `git push` work.

**Why:** The connector and the workspace Git tool authorize different paths. Trying HTTPS, SSH, or a GitHub CLI session does not make connector credentials available to Git, and extracting tokens into shell commands risks exposing them.

**How to apply:** Keep the remote free of embedded credentials. For a native Git push, use the workspace Git pane's account authorization, then verify the remote branch. Do not request a token in chat or silently replace the repository's history with an API-created snapshot.