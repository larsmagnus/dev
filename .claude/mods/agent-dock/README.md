# agent-dock

A live list of the session's subagents and background shells. It splits another plugin's pane (filetree by default), so the host's tree sits on top and the list below, with a draggable divider whose position is remembered. With no host pane open, it opens its own `Agents` pane once there is something to show. `/agents` opens that pane on demand.

## Install

```sh
claude plugin marketplace add ~/sites/dev/.claude/mods
claude plugin install agent-dock@larsmagnus --scope user
```

Edits apply with `/reload-plugins`. No reinstall needed.

## Load order

agent-dock must be listed before the host plugin in `enabledPlugins`. filetree draws its pane without calling `next`, so any plugin after it never gets its `ui.render` hook. Installing or toggling plugins can reorder that list. If the split disappears, check this first.

## Shells

A shell is a Bash command left running in the background. The engine gives it no name, so it is listed as `shell`. It ends in one of three ways:

- Its task notification arrives, and it takes the status that notification reports.
- Its subagent finishes first. No notification follows, so it is `killed`.
- A turn ends and the engine no longer lists it as in flight. It is `completed`, which covers a notification that never arrived. A shell whose subagent is still running is left alone.

## Details

Click a row, or press Enter, to open its details (status, start, task or command, id) and its transcript. A shell has details but no transcript.

## Archive

Finished agents collapse into an archive and are never removed. With `autoArchiveMinutes` set, they collapse on their own once they have been finished that long.

## Context

Rows show tokens, not a context percentage. The engine gives no context window per agent, so a percentage would be a guess.

## Resumed sessions

Rows are stored per session id, for the most recent sessions only. Resuming a session brings its rows back. Anything still live then comes back as `killed`, since its process is gone.

## Settings

Set under agent-dock in `/config`.

- `hostPane`: default `filetree`. The id of another plugin's pane to split. Empty means agent-dock always uses its own pane.
- `autoArchiveMinutes`: default `20`. `0` turns auto-archive off, leaving archiving to you.

## Engine constraints

The plugin engine enforces these at load. They shape the code, so don't "fix" them.

- A plugin has exactly one hooks module. Here it is `hooks/register.tsx`.
- Anything that touches `$` or a state atom must live in that module, in top-level functions. `$` cannot be passed into an imported function.
- `register.tsx` is excluded from the complexity cap by name, since it is the wiring. All other logic lives in small files under the cap.

## Layout limits

Found by probing. A layout manager can't get past these.

- Background tabs are not drawn, so two plugins' live panes can't sit side by side.
- A host pane's height is set through `scroll.bodyRows`. That is how agent-dock gives the host exactly its share.

## Tests

```sh
claude plugin test .
```
