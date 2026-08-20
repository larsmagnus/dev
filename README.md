# larsmagnus/dev

Dev setup, tooling, themes and productivity workflows.

## Packages

- [`root`](./packages/root/) - root config, including terminal and shell setup.
- [`scripts`](./packages/scripts/) - dev setup, config and productivity scripts.
- [`vscode`](./packages/vscode/) - vscode user settings, extensions and themes.
- [`obsidian`](./packages/obsidian/) - obsidian config, templates and theming.

## Claude Code

[`CLAUDE.md`](./CLAUDE.md) and everything in [`.claude/`](./.claude/) are symlinked into `~/.claude/` to track my global setup.

Add new Claude config in this repo rather than in `~/.claude/` directly, then link it.

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
