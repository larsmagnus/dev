---
name: install
description: Download the mermaid and drawio browser libraries the diagrams mod draws with. Use when the user runs /diagrams:install, or the mod toasts that its libraries are missing.
---

# Install diagram libraries

Put each file below in `~/.claude/diagrams/library/` under the name given, then verify its checksum. The mod draws nothing until both exist.

| File                   | Source                                                                                            | sha256                                                             | Licence    |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| `mermaid.min.js`       | `https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.min.js`                                 | `a8a6a6f805b074a8261a2825c86f99c8054acb3b35f50bb7e24a4f9f2c3c3b9f` | MIT        |
| `drawio-viewer.min.js` | `https://raw.githubusercontent.com/jgraph/drawio/v29.0.3/src/main/webapp/js/viewer-static.min.js` | `f34eb844dea925189697ef3a175b5bb425a4df6900661feda86eabed80f14719` | Apache-2.0 |

## Steps

1. `mkdir -p ~/.claude/diagrams/library`.
2. For each file, skip it when it already exists with the right checksum. Otherwise `curl -fsSL -o <path> <source>`.
3. Compare `shasum -a 256 <path>` with the table. On a mismatch delete the file, report which one, and stop. Never keep or use an unverified file.
4. Check a Chromium-based browser is installed: Chrome, Chromium, Brave or Edge in `/Applications`. If none is, say the mod needs one, or `chromePath` set in `/config`.
5. Tell the user the next reply with a diagram will draw; no reload is needed.

## Updating a library

Change the source and checksum in this table together, and pick a release at least two weeks old. Delete the old file from the library folder so step 2 fetches the new one.
