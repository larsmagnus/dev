# larsmagnus/dev dark

![larsmagnus/dev dark in VS Code](screenshot.png)

[One Dark Pro Darker](https://github.com/Binaryify/OneDark-Pro) (MIT, Binaryify) flattened into a standalone theme, so it doesn't depend on that extension staying installed or changing underneath it. Palette overrides live in the theme file, not in `settings.json`.

Not published to the Marketplace. `pnpm install:vscode` builds the `.vsix` and installs it.

## Install without building a `.vsix`

Copy (or symlink, to pick up edits) the extension files into VS Code's extensions folder, then restart VS Code:

```sh
dest="$HOME/.vscode/extensions/larsmagnus.larsmagnus-dev-theme-1.0.0"
mkdir -p "$dest"
cp -R package.json themes LICENSE "$dest"
```

Then pick `larsmagnus/dev dark` via `Preferences: Color Theme`. The folder name must be `<publisher>.<name>-<version>`. Bump it with `package.json` when the version changes and remove the old folder.

To use only the colors without an extension, copy the `colors` object from `themes/larsmagnus-dev-dark.json` into `workbench.colorCustomizations` in `settings.json` on top of any base theme. Syntax colors (`tokenColors`) go in `editor.tokenColorCustomizations`.

## Editing the theme

Built-in VS Code tools cover most of it:

- `Developer: Inspect Editor Tokens and Scopes` shows the scope, semantic token and resolved color under the cursor. Use it to find which `tokenColors` rule to change.
- `Developer: Generate Color Theme From Current Settings` dumps the active colors and token rules into a theme file, to check what a theme actually resolves to.
- Theme JSON files get key validation, autocompletion for every workbench color, and inline color swatches and pickers.
- Open this folder in its own window and press F5 to launch an Extension Development Host. Edits to the theme JSON apply on save, without rebuilding the `.vsix`.
- Try colors in `workbench.colorCustomizations` and `editor.tokenColorCustomizations` first, since they apply instantly. Move them into the theme file once settled.

Reference: [Theme Color](https://code.visualstudio.com/api/references/theme-color) lists every workbench color key and what it controls.

## Screenshot

`pnpm screenshot` captures the theme in a real VS Code window using a throwaway profile. It needs Accessibility and Screen Recording permission for the terminal. Setup and the `SCALE` and `SELECT_LINE` options are documented in `scripts/screenshot.sh`.
