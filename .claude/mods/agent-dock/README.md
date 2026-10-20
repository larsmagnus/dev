# agent-dock

A live list of the session's subagents and background shells.

![Mod panel with agent-dock](larsmagnus-agent-dock.png)

Splits a host plugin's pane to show agent-dock below, with a draggable divider. Without a host it opens its own `Agents` pane once there is something to show.

## Install

```sh
claude plugin marketplace add ~/sites/dev/.claude/mods
claude plugin install agent-dock@larsmagnus --scope user
```

Edits apply with `/reload-plugins`. No reinstall needed.

## Load order

List agent-dock before the host plugin in `enabledPlugins`. filetree draws without calling `next`, so later plugins never get `ui.render`. Installing or toggling plugins can reorder the list. If the split disappears, check this first.

## Commands

- `/agent-dock:set-host <pane id>`: pane to split, e.g. `filetree`. No id clears it. No host by default.
- `/agent-dock:layout`: toggle `split` (default) or `tab`. Also the button at the right of the `Agents` header.
- `/agent-dock:toggle`: open or close the own pane.

Host and layout persist across sessions. Without a host there is no button, and `layout` does nothing.

- `split` puts the list below the host pane.
- `tab` shows only the own `Agents` pane and leaves the host pane untouched.

## Shells

A Bash command left running in the background. The engine gives it no name, so it is listed as `shell`. It ends when:

- Its task notification arrives. It takes the reported status.
- Its subagent finishes first. It is `killed`, as no notification follows.
- A turn ends and the engine no longer lists it. It is `completed`. A shell whose subagent still runs is left alone.

## Details

Click a row or press Enter to open its details (status, start, task or command, id) and transcript. A shell has no transcript.

## Archive

Finished agents collapse into an archive and are never removed. `autoArchiveMinutes` collapses them automatically.

## Context

Rows show tokens, not a percentage. The engine gives no context window per agent.

## Resumed sessions

Rows are stored per session id, for recent sessions only. Resuming restores them. Anything live comes back `killed`, as its process is gone.

## Settings

Under agent-dock in `/config`.

- `autoArchiveMinutes`: default `20`. `0` turns auto-archive off.

## Engine constraints

The engine imposes these. They shape the code, so don't "fix" them.

- A plugin has exactly one hooks module. Here it is `hooks/register.tsx`.
- Anything that touches `$` or a state atom must live in that module, in top-level functions. `$` cannot be passed into an imported function.
- `register.tsx` is excluded from the complexity cap by name, since it is the wiring. All other logic lives in small files under the cap.

## Layout limits

Found by probing.

- Background tabs are not drawn, so two plugins' live panes can't sit side by side.
- A host pane's height is set through `scroll.bodyRows`, which is how the host gets its share.

## Tests

```sh
claude plugin test .
```
