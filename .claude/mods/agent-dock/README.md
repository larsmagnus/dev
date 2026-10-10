# agent-dock

Splits another plugin's dock pane (filetree by default) into the host's tree on top and a live list of subagents below. Each agent shows its type, status, elapsed time, description, and two lines of live activity. Drag the divider to resize. The position is remembered. Click a row to open its transcript in the pane. Finished agents collapse into an archive and are never removed. They auto-archive after a set time. Failed or killed agents raise a toast. With no host pane open, agent-dock opens its own `Agents` pane, and `/agents` opens it on demand.

## Install

```sh
claude plugin marketplace add ~/sites/dev/.claude/mods
claude plugin install agent-dock@larsmagnus --scope user
```

Edits apply with `/reload-plugins`. No reinstall needed.

## Settings

Set under agent-dock in `/config`.

- `hostPane`: default `filetree`. Empty means agent-dock always uses its own pane.
- `autoArchiveMinutes`: default `20`. `0` turns auto-archive off.

## Load order

agent-dock must be listed before the host plugin in `enabledPlugins`. filetree draws its pane without calling `next`, so any plugin after it never gets its `ui.render` hook. Installing or toggling plugins can reorder that list. If the split disappears, check this first.

## Engine constraints

The plugin engine enforces these at load. They shape the code, so don't "fix" them.

- A plugin has exactly one hooks module. Here it is `hooks/register.tsx`.
- Anything that touches `$` or a state atom must live in that module, in top-level functions. `$` cannot be passed into an imported function.

`register.tsx` sits over the repo's complexity cap, knowingly. Pure logic lives in the other files, so the wiring is the only part over the cap.

## Layout limits

Found by probing. A layout manager can't get past these.

- Background tabs are not drawn, so two plugins' live panes can't sit side by side.
- A host pane's height can be rewritten through `scroll.bodyRows`. That is how the host gets exactly its share.

## Tests

```sh
claude plugin test .
```
