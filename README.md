# larsmagnus/dev

Dev setup, tooling, themes and productivity workflows.

## Packages

- [`root`](./packages/root/) - root config, including terminal and shell setup
- [`scripts`](./packages/scripts/) - dev setup, config and productivity scripts
- [`vscode`](./packages/vscode/) - vscode user settings, extensions and themes
- [`obsidian`](./packages/obsidian/) - obsidian config, templates and theming

## Claude Code

Some of the setup I use every day for work.

### Settings

- [settings.json](.claude/settings.json) - Guardrails for secrets and sensible defaults

### Hooks

Do as much deterministic work as possible with hooks.

- [complexity](.claude/hooks/complexity/index.mts) - Check code complexity with fta to keep files simple
- [duplication](.claude/hooks/duplication/index.mts) - Check for duplicates and near-duplicates to avoid bloat
- [format](.claude/hooks/format/index.mts) - Format and auto-fix with oxlint and oxfmt to reduce iteration cycles

### Rules

Prefer deterministic work in hooks, linting and formatting before rules.

- [react-quality](.claude/rules/react-quality.md) - Fix common Claude mistakes
- [testing-quality](.claude/rules/testing-quality.md) - Nudge to use the architect and sets preferences
- [typescript-quality](.claude/rules/typescript-quality.md) - Enforce a schema-first approach

### Agents

Keep agents lean and in the background.

- [content-architect](.claude/agents/content-architect.md) - Understand large-scale content structures with minimal context use
- [docs-architect](.claude/agents/docs-architect.md) - Write crystal clear docs and treat code as the source of truth
- [test-architect](.claude/agents/test-architect.md) - Make tests that give you confidence to change

### Skills

Make them easy and predictable to use for humans and agents.

- [commit](.claude/skills/commit/SKILL.md)
- [feedback-loop](.claude/skills/feedback-loop/SKILL.md)

---

### Symlinks

[`CLAUDE.md`](./CLAUDE.md) and everything in [`.claude/`](./.claude/) are symlinked into `~/.claude/` to track my global setup.

Add new Claude config in this repo rather than in `~/.claude/` directly, then symlink.

### Restoring symlinks

If you clone this repo fresh, re-create the symlinks:

```sh
ln -sf "$(pwd)/CLAUDE.md" ~/.claude/CLAUDE.md
for entry in .claude/*; do
  ln -sfn "$(pwd)/$entry" ~/.claude/"$(basename "$entry")"
done
```

---

## Disclaimer

Use or not at your own risk.
