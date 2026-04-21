# larsmagnus/dev

Dev setup, tooling, themes and productivity workflows.

## Packages

- [`root`](./packages/root/) - root config, including terminal and shell setup.
- [`scripts`](./packages/scripts/) - dev setup, config and productivity scripts.
- [`vscode`](./packages/vscode/) - vscode user settings, extensions and themes.
- [`obsidian`](./packages/obsidian/) - obsidian config, templates and theming.

## Claude Code

[`CLAUDE.md`](./CLAUDE.md) and [`.claude/agents/`](./.claude/agents/) are versioned here and symlinked back to the root `~/.claude/` so changes are tracked in git.

### Restoring symlinks

If you clone this repo fresh, re-create the symlinks manually:

```sh
ln -sf "$(pwd)/CLAUDE.md" ~/.claude/CLAUDE.md
ln -sf "$(pwd)/.claude/agents" ~/.claude/agents
```

## Disclaimer

Use or not at your own risk.
