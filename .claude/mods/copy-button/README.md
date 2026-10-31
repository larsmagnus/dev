# copy-button

A copy button on each of Claude's messages. It puts that message's raw markdown on the clipboard.

![Green copy buttons on messages, with a toast confirming the copy](larsmagnus-copy-button.png)

## Install

```sh
claude plugin marketplace add larsmagnus/dev
claude plugin install copy-button@larsmagnus --scope user
```

## Updating

Enable auto-update for `larsmagnus` in `/plugin`.

### Manually updating

```sh
claude plugin marketplace update larsmagnus
```

Remember to run `/reload-plugins` after manually updating.

## Usage

- `[ copy ]`, in the theme's success colour, sits at the top right of each message.
- Messages of at least `longMessageChars` characters, or taller than the screen, also get one below. Set `longMessageChars` in `/config`.
- A reply split by tool calls gets one button per text block. Summaries and blank messages get none.
- Presses are mouse clicks, so no button is drawn outside fullscreen rendering (`tui: fullscreen`).

## No command or hotkey

Built-in `/copy` already copies a whole reply, so the mod adds none of its own. Set `copyFullResponse: true` in `~/.claude.json` to skip its picker. Bind `command:copy` in `~/.claude/keybindings.json` for a hotkey.
