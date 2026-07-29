# larsmagnus/dev

Dev setup, tooling, themes and productivity workflows.

## Packages

- [`root`](./packages/root/) - root config, including terminal and shell setup.
- [`scripts`](./packages/scripts/) - dev setup, config and productivity scripts.
- [`vscode`](./packages/vscode/) - vscode user settings, extensions and themes.
- [`obsidian`](./packages/obsidian/) - obsidian config, templates and theming.

## Claude Code

[`CLAUDE.md`](./CLAUDE.md) and everything in [`.claude/`](./.claude/) — agents, skills, and whatever else gets added — are versioned here and symlinked back into `~/.claude/` so changes are tracked in git. Add new Claude config in this repo rather than in `~/.claude/` directly, then link it.

### Restoring symlinks

If you clone this repo fresh, re-create the symlinks:

```sh
ln -sf "$(pwd)/CLAUDE.md" ~/.claude/CLAUDE.md
for entry in .claude/*; do
  ln -sfn "$(pwd)/$entry" ~/.claude/"$(basename "$entry")"
done
```

## Disclaimer

Use or not at your own risk.
