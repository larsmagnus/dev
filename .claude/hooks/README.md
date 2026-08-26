# Claude Code hooks

`PostToolUse` hooks (`matcher: "Edit|Write"`), shared globally.

| Hook                                 | Description                                                          | Details                                                                                                                                 | Mode   | Scope         |
| ------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| [format](format/index.mts)           | Format and auto-fix with oxlint and oxfmt to reduce iteration cycles | Runs the project's own [oxlint](https://oxc.rs/docs/guide/usage/linter) `--fix` then [oxfmt](https://oxc.rs/docs/guide/usage/formatter) | write  | edited file   |
| [complexity](complexity/index.mts)   | Check code complexity with fta to keep files simple                  | Runs [fta-cli](https://ftaproject.dev/), fails above the score cap                                                                      | report | edited file   |
| [duplication](duplication/index.mts) | Check for duplicates and near-duplicates to avoid bloat              | Runs [jscpd](https://jscpd.dev/), fails if the edited file shares a duplicated block in the project                                     | report | whole project |

### Config

Scripts run with `cwd` set to the edited project's root to apply the project's own config.

#### format

- **No default config:** oxlint/oxfmt only look for the project's own `.oxlintrc.json` / `.oxfmtrc.json`
- **Binaries:** Resolved by walking up from the edited file to the nearest `node_modules/.bin`
- **Order:** Must run before `complexity` and `duplication` to ensure their reporting is correct
- **Errors:** Warns once per session if oxlint/oxfmt are missing, otherwise fixes, formats, and hands remaining lint errors to Claude.

**Note:** runs on every edited file regardless of extension and silently no-op on files they don't support.

#### complexity / duplication

- **Project config:** Look for `fta.json` / `.jscpd.json` at the project root first
- **Default config:** Fall back to configs in this repo if project config is missing

**Note:** both default configs ignore `components/ui`

### Wiring

- This directory and `settings.json` are symlinked into `~/.claude` (see root [README](../../README.md))

- The [`PostToolUse` block in `../settings.json`](../settings.json) is the live global wiring

**Note:** [hook entries merge across settings levels](https://code.claude.com/docs/en/hooks#settings-precedence) instead of replacing each other - a project can add hooks but can't edit these ones directly.

### Dependencies

- `format` only imports `zod` and resolves oxlint/oxfmt from the target project
- `fta-cli`, `jscpd` and `zod` live in this repo's root `package.json`

**Note:** Node resolves each script's imported modules from their (symlink-resolved) location upward, so from `dev/node_modules`
