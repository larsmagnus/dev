# agent-dock

Splits another plugin's dock pane (filetree by default) into the host's tree on top and a live list of subagents and background shells below. Drag the divider to resize. The position is remembered. With no host pane open, agent-dock opens its own `Agents` pane, and `/agents` opens it on demand.

## Rows

- Title: `● type`, with the dot and name shimmering while the agent runs. Then the status, coloured by state, then elapsed time and `ctx` tokens of the agent's latest request.
- Description: white, one line.
- Activity: dim, the two newest lines.

A shell is a Bash command left running in the background. Its title carries `(shell)` and is its description, or its command when it has none, cut to one short line. A shell ends when its task notification arrives. When the subagent that ran it finishes first, no notification follows, so the shell is marked `killed`.

A scrollbar sits beside the list and the transcript. Wheel ticks over the list scroll it.

Failed or killed agents raise a toast. Finished agents collapse into an archive and are never removed. They auto-archive after a set time.

## Details

Click or Enter on a row opens its details (status, started, task or command, id) and its transcript, in one scrolling run under a back button. Edits show as red `-` and green `+` lines.

## Colours

An agent takes the `color:` from its agent file's frontmatter. The project's `.claude/agents` is checked first, then the user's `~/.claude/agents`. Without one, it takes the next colour from a fixed palette, in arrival order.

## Why

- The title is a real focusable Button. Keyboard navigation is a requirement, and plain text cannot take focus.
- The shimmer is driven by the plugin. The engine has no animation, so while anything runs the plugin steps a phase on a timer. Each step redraws the pane, and that redraws the host's tree too. The step is slow for that reason, and it only runs while a row is running.
- There is no context %. The engine gives no context window per agent, so a percentage would be a guess. `ctx` shows the input and cache tokens of the agent's latest request instead.

## Resumed sessions

The engine forgets its agents with the process, so rows are kept in the plugin's store per session id, for the most recent sessions only. A resumed session restores its rows. Anything still live comes back as `killed`, since its process is gone.

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

`register.tsx` is excluded from the repo's complexity cap by name, since it is the wiring. All other logic lives in small files that stay under the cap.

## Layout limits

Found by probing. A layout manager can't get past these.

- Background tabs are not drawn, so two plugins' live panes can't sit side by side.
- A host pane's height can be rewritten through `scroll.bodyRows`. That is how the host gets exactly its share.

## Tests

```sh
claude plugin test .
```
