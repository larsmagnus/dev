# larsmagnus/dev vscode

VSCode user settings, keybindings, extensions and themes.

## Uses

- [VSCode](https://code.visualstudio.com/)
- Theme: `larsmagnus/dev dark` - own extension in `theme/`, derived from One Dark Pro Darker. `pnpm install:vscode` there builds and installs it.
- Font: [Monaspace](https://monaspace.githubnext.com/)

## Extensions

- larsmagnus.larsmagnus-dev-theme
- larsmagnus.punchdown
- anthropic.claude-code
- apollographql.vscode-apollo
- bierner.markdown-checkbox
- bierner.markdown-preview-github-styles
- bradlc.vscode-tailwindcss
- davidanson.vscode-markdownlint
- dbaeumer.vscode-eslint
- dnicolson.binary-plist
- docker.docker
- drcika.apc-extension
- eamodio.gitlens
- esbenp.prettier-vscode
- figma.figma-vscode-extension
- firsttris.vscode-jest-runner
- geequlim.godot-tools
- github.vscode-github-actions
- hoovercj.vscode-settings-cycler
- jetmartin.bats
- mdickin.markdown-shortcuts
- mechatroner.rainbow-csv
- mermaidchart.vscode-mermaid-chart
- ms-azuretools.vscode-containers
- ms-azuretools.vscode-docker
- ms-playwright.playwright
- ms-python.debugpy
- ms-python.python
- ms-python.vscode-pylance
- ms-python.vscode-python-envs
- ms-vscode-remote.remote-containers
- ms-vscode-remote.remote-ssh
- ms-vscode-remote.remote-ssh-edit
- ms-vscode.extension-test-runner
- ms-vscode.remote-explorer
- nrwl.angular-console
- oxc.oxc-vscode
- prisma.prisma
- redhat.java
- redhat.vscode-yaml
- ryuta46.multi-command
- stylelint.vscode-stylelint
- svelte.svelte-vscode
- timonwong.shellcheck
- unifiedjs.vscode-mdx
- usernamehw.errorlens
- vscjava.vscode-gradle
- vscjava.vscode-java-debug
- vscjava.vscode-java-dependency
- vscjava.vscode-java-pack
- vscjava.vscode-java-test
- vscjava.vscode-maven
- yahyabatulu.vscode-markdown-alert
- yoavbls.pretty-ts-errors
- yzhang.markdown-all-in-one
- zhuangtongfa.material-theme
- wallabyjs.console-ninja

## Theming

- [Theme color reference](https://vscode-docs1.readthedocs.io/en/latest/getstarted/theme-color-reference/)

## Syncing VSCode `settings.json` to GitHub

I use [symbolic links](https://en.wikipedia.org/wiki/Symbolic_link) to sync VSCode's `settings.json` and `keybindings.json` to GitHub instead of VSCode's built-in [Settings Sync](https://code.visualstudio.com/docs/editor/settings-sync). That's likely going to be the best solution for most people.

I've chosen this approach for its transparent control, secure separation of concerns and reliability. Without mixing personal and work accounts.

### Steps to sync

1. Locate your VSCode `settings.json` file:

The location of `settings.json` varies by os:

- macOS: `$HOME/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%\Code\User\settings.json`
- Linux: `$HOME/.config/Code/User/settings.json`

2. Move both files into the repo. Run the rest from the repo root:

```sh
# Example for macOS:
user="$HOME/Library/Application Support/Code/User"
mv "$user/settings.json" packages/vscode/settings.json
mv "$user/keybindings.json" packages/vscode/keybindings.json
```

3. Create symbolic links:

```sh
# WARN `f` overwrites the existing file
ln -sf "$(pwd)/packages/vscode/settings.json" "$user/settings.json"
ln -sf "$(pwd)/packages/vscode/keybindings.json" "$user/keybindings.json"
```

4. Commit and push

```sh
git add packages/vscode/settings.json packages/vscode/keybindings.json
git commit -m "chore: add VSCode settings"
git push origin main
```

Consider setting up a script to periodically auto commit + push when `settings.json` is updated.
