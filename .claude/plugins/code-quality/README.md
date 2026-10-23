# code-quality

Format, complexity and duplication checks after every edit. Failures go back to Claude as feedback.

## Install

```sh
claude plugin install code-quality@larsmagnus
```

## Updating

Enable auto-update for `larsmagnus` in `/plugin`.

### Manually updating

```sh
claude plugin marketplace update larsmagnus
```

Remember to run `/reload-plugins` after manually updating.

## Why one entry hook

Claude Code runs matching hooks in parallel. As separate hooks, the analysers could read a file before format rewrites it. One `PostToolUse` entry runs format, complexity and duplication in that order. It costs about 0.2s per edit.

## Project tools win

The project's own oxlint, oxfmt, `.oxlintrc.json`, `fta.json` and `.jscpd.json` are used when present. The plugin's copies and bundled configs are only a fallback, so projects without them still get checks.

Formatting uses the project's oxfmt for a reason. A different version would reformat the whole file against other conventions.

## Prerequisites

- Node 22.18 or newer. Hooks run `.mts` files directly.
- `npm` on `PATH`, used once to install dependencies.
- The first session installs dependencies into the plugin data directory. It needs network, and again only when the plugin's `package.json` changes.
- An offline first session does nothing. Hooks stay quiet until a later session installs the dependencies.
