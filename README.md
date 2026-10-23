<div align="left">
  <img src="https://raw.githubusercontent.com/larsmagnus/dev/main/public/banner-midnight.png" alt="/dev The supercharged AI toolkit" width="500" height="252" />
</div>

# larsmagnus/dev

Dev setup, tooling, themes and productivity workflows.

## Packages

- [`root`](./packages/root/) - root config, including terminal and shell setup
- [`scripts`](./packages/scripts/) - dev setup, config and productivity scripts
- [`vscode`](./packages/vscode/) - vscode user settings, extensions and themes
- [`obsidian`](./packages/obsidian/) - obsidian config, templates and theming

## Claude Code

The setup I use every day for work.

### Install

```sh
claude plugin marketplace add larsmagnus/dev
claude plugin install agent-dock@larsmagnus
claude plugin install attachments@larsmagnus
claude plugin install release-highlights@larsmagnus
claude plugin install code-quality@larsmagnus
claude plugin install docs-review@larsmagnus
```

Requires Node 22.18 or newer.

### Updating

The plugins are not versioned. Every commit on main counts as a new version.

Enable auto-update for `larsmagnus` in `/plugin`.

#### Manually updating

```
claude plugin marketplace update larsmagnus
```

Remember to run `/reload-plugins` after manually updating.

### Settings

- [settings.json](.claude/settings.json) - Guardrails for secrets and sensible defaults

### Hooks

Do as much deterministic work as possible with hooks.

- [code-quality](.claude/plugins/code-quality/README.md) - Format, complexity and duplication checks after every edit
- [docs-review](.claude/plugins/docs-review/README.md) - Flag new inline comments for docs-architect review against CLAUDE.md

### Rules

Prefer deterministic work in hooks, linting and formatting before rules.

- [react-quality](.claude/rules/react-quality.md) - Fix common Claude mistakes
- [testing-quality](.claude/rules/testing-quality.md) - Nudge to use the architect and sets preferences
- [typescript-quality](.claude/rules/typescript-quality.md) - Enforce a schema-first approach

### Agents

Keep agents lean and in the background.

- [content-architect](.claude/agents/content-architect.md) - Understand large-scale content structures with minimal context use
- [docs-architect](.claude/plugins/docs-review/agents/docs-architect.md) - Write crystal clear docs and treat code as the source of truth
- [test-architect](.claude/agents/test-architect.md) - Make tests that give you confidence to change

### Skills

Make them easy and predictable to use for humans and agents.

- [commit](.claude/skills/commit/SKILL.md)
- [docs](.claude/plugins/docs-review/skills/docs/SKILL.md)
- [feedback-loop](.claude/skills/feedback-loop/SKILL.md)

### Mods

Change Claude's own interface. Shipped as the [larsmagnus](.claude-plugin/marketplace.json) plugin marketplace.

- [agent-dock](.claude/mods/agent-dock/README.md) - Live subagents beside your files in a resizable dock pane
- [attachments](.claude/mods/attachments/README.md) - Every image and file you attach, saved with thumbnails and refs to re-insert
- [release-highlights](.claude/mods/release-highlights/README.md) - Changelog highlights band above the prompt after Claude Code updates

### Themes

- [dark-terminal-dock](.claude/themes/dark-terminal-dock.json) - Dark base tuned to match the terminal dock

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
