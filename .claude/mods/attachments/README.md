# attachments

Lists every image pasted or dropped into a session, and every existing file whose absolute path a prompt contains. Subagent conversations are ignored.

![Mod panel with attachments](larsmagnus-attachments.png)

`/attachments:open` opens the archive pane.

While you type, a band above the prompt previews the images and files the draft names, and clears once the prompt is sent. Click a tile to open its file.

![Band above the prompt with attachments](larsmagnus-attachments-preview.png)

## Requirements

macOS. `sips` makes thumbnails and reads image sizes. `base64 -D` decodes pasted images. Thumbnails need the kitty graphics protocol (Ghostty, kitty). Elsewhere entries show a text placeholder. Without `sips`, entries still list, just without thumbnails or dimensions.

## Install

```sh
claude plugin marketplace add larsmagnus/dev
claude plugin install attachments@larsmagnus --scope user
```

## Updating

Enable auto-update for `larsmagnus` in `/plugin`.

### Manually updating

```sh
claude plugin marketplace update larsmagnus
```

Remember to run `/reload-plugins` after manually updating.

## Refs

`[Image #n]` is the engine's ref. Files get `[File #n]`, numbered by the mod. A media block without an inline ref gets `[Attachment #n]`.

Clicking a ref inserts its path too. Compaction can drop an image from context, but the path lets Claude still Read the file.

## Draft preview

Pasting raises no prompt event and the engine exposes a paste's bytes only at submit, so the band polls the draft for `[Image #n]` refs and reads the file the engine already cached for each paste under its temp folder. Thumbnails of drafts are written to `draft/` in the session's archive folder.

## Storage

Pasted images are decoded to `~/.claude/attachments/<sessionId>/`. A pasted image exists only as base64 in the transcript, so decoding is what makes it openable. The file suffix is the start of the prompt's message id. A ref is only a label and can repeat, for example after a resumed session numbers images again, so entries are identified by path. Archive folders are never deleted.

Dropped files stay where they are. Only a thumbnail is written to the archive folder, so an entry breaks if its file moves. `index.json` in each folder restores the list on resume.

## Engine constraints

The engine imposes these. They shape the code, so don't "fix" them.

- A plugin has exactly one hooks module. Here it is `hooks/register.tsx`.
- State atoms must be named in that module. `$` passes into an imported `function` declaration, never an imported arrow function, so `$`-only helpers live in `hooks/host.ts` and `hooks/draft-sources.ts` as declarations.
- An `Image` takes no press, and a `Button` holds only text. So an invisible `Client` (`hooks/thumb-hit.tsx`) lies over each thumbnail. Drawing anything inside it would cover the picture.
- A `Box` hover restyles only a border it already has. So the frame is always drawn, dimmed, and lights on hover.
- The terminal `Image` reads only PNG from a file, hence `sips` thumbnails.

## Tests

```sh
claude plugin test .
```
