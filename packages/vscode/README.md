# larsmagnus/dev vscode

VSCode user settings, extensions and themes.

## Uses

- [VSCode](https://code.visualstudio.com/)
- Theme: `One Dark Pro Darker` - extended in `settings.json` to suit me.
- Font: [Monaspace](https://monaspace.githubnext.com/)

## Extensions

- dbaeumer.vscode-eslint
- esbenp.prettier-vscode
- timonwong.shellcheck
- stylelint.vscode-stylelint
- bradlc.vscode-tailwindcss
- YoavBls.pretty-ts-errors
- eamodio.gitlens
- firsttris.vscode-jest-runner
- ms-playwright.playwright
- yahyabatulu.vscode-markdown-alert
- bierner.markdown-preview-github-styles
- ryuta46.multi-command
- nrwl.angular-console
- zhuangtongfa.material-theme
- usernamehw.errorlens
- WallabyJs.console-ninja
- drcika.apc-extension
- ms-vscode-remote.remote-containers

## Theming

- [Theme color reference](https://vscode-docs1.readthedocs.io/en/latest/getstarted/theme-color-reference/)

## Syncing VSCode `settings.json` to GitHub

I use [symbolic links](https://en.wikipedia.org/wiki/Symbolic_link) to sync VSCode's `settings.json` to GitHub instead of VSCode's built-in [Settings Sync](https://code.visualstudio.com/docs/editor/settings-sync). That's likely going to be the best solution for most people.

This approach provides transparent control, secure separation of concerns and reliability. Without mixing personal and work accounts.

### Steps to sync

1. Locate your VSCode `settings.json` file:

The location of `settings.json` varies by os:

- macOS: `$HOME/Library/Application Support/Code/User/settings.json`
- Windows: `%APPDATA%\Code\User\settings.json`
- Linux: `$HOME/.config/Code/User/settings.json`

2. Move `settings.json` to your repo:

```sh
# Example for macOS:
mv "$HOME/Library/Application Support/Code/User/settings.json" ~/vscode-settings/settings.json
```

3. Create a symbolic link:

```sh
# Example for macOS
# WARN `f` overwrites the existing file
ln -sf ~/dev/packages/vscode/settings.json "$HOME/Library/Application Support/Code/User/settings.json"
```

6. Commit and push

```sh
cd ~/dev/packages/vscode
git add settings.json
git commit -m "chore: add VSCode settings"
git push origin main
```

Consider setting up a script to periodically auto commit + push when `settings.json` is updated.
