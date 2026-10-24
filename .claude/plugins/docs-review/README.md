# docs-review

Flags new inline comments for review by the `docs-architect` agent, and a `/docs-review:check` skill for on-demand reviews.

## Install

```sh
claude plugin install docs-review@larsmagnus
```

## Updating

Enable auto-update for `larsmagnus` in `/plugin`.

### Manually updating

```sh
claude plugin marketplace update larsmagnus
```

Remember to run `/reload-plugins` after manually updating.

## How it works

The hook runs after every `Edit` and `Write`. For an edit, only comments the new text adds or changes count. A full-file rescan would flag existing, already reviewed comments on every touch.

## Depends on CLAUDE.md

Reviews hold comments to whatever your `CLAUDE.md` says about comments and docs. Write that guidance there, in the user or project file: when a comment should exist, what it should say, and what to delete. Without it the agent defaults to deleting comments the code already explains.

## Prerequisites

- Node 22.18 or newer. Hooks run `.mts` files directly.
- `npm` on `PATH`, used once to install dependencies.
- The first session installs dependencies into the plugin data directory. It needs network, and again only when the plugin's `package.json` changes.
- An offline first session does nothing. Hooks stay quiet until a later session installs the dependencies.
