# Claude Code hooks

`PostToolUse` hooks (`matcher: "Edit|Write"`) that nudge Claude to fix complexity or duplication before it compounds, shared across every repo from this one place instead of copy-pasted per project.

- `check-complexity.mts` — runs [`fta-cli`](https://ftaproject.dev/) on the edited file, fails with feedback above the score cap.
- `check-duplication.mts` — re-scans the project with [`jscpd`](https://jscpd.dev/), fails with feedback if the edited file shares a duplicated block with another file.

## Config resolution

Both scripts run with `cwd` set to the edited project's root (Claude Code's default for hook commands). Each looks for its config there first — `fta.json` / `.jscpd.json` — and only falls back to the generic defaults bundled in this directory if the project has none of its own. To customize behavior for one repo, just drop an `fta.json` and/or `.jscpd.json` at its root; no wiring changes needed.

The bundled defaults ignore `components/ui` — most projects pull that directory in wholesale via shadcn, so it isn't code worth flagging for complexity or duplication.

## Wiring

Symlinked from `~/.claude/hooks` (see this repo's root `README.md` for the general symlink pattern). Wired up globally in `~/.claude/settings.json`:

```json
{
	"hooks": {
		"PostToolUse": [
			{
				"matcher": "Edit|Write",
				"hooks": [
					{
						"type": "command",
						"command": "node --no-warnings ~/.claude/hooks/check-complexity.mts"
					},
					{
						"type": "command",
						"command": "node --no-warnings ~/.claude/hooks/check-duplication.mts"
					}
				]
			}
		]
	}
}
```

That file is machine-local and not versioned here — re-add this snippet if setting up a new machine.

## Dependencies

`fta-cli`, `jscpd`, and `zod` live in this repo's root `package.json`, since Node resolves each script's bare imports from its own real (symlink-resolved) location upward — i.e. from `dev/node_modules`, regardless of which project's files triggered the hook.
