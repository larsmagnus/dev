#!/usr/bin/env bash
set -euo pipefail

# Captures the theme in a real VS Code window, so the shot shows the actual
# chrome and syntax colors rather than an approximation.
#
# Runs in a throwaway profile under /tmp with the theme copied straight from
# this repo, so unbuilt edits show up and the everyday setup is untouched.
# The window is targeted by PID, never by title, so a real VS Code window on
# the same file can't be hit by the keystrokes or the Cmd+Q.
#
# The file is opened without a folder because that is what makes VS Code hide
# the Explorer; the Cmd+B toggle was unreliable.
#
# Window size is in points and the capture is Retina, so SCALE enlarges the
# window and zooms the UI by the same factor for more pixels at an identical
# layout. macOS clamps windows to the screen: 1.5 is the most that fits a
# 1470x956 display, and a larger value silently crops the shot.
#
# One-time prerequisite: the terminal needs Accessibility and Screen Recording
# (System Settings -> Privacy & Security). A missing Screen Recording grant
# fails as "no quartz window", not as a permission error.
#
# Usage: scripts/screenshot.sh [output.png]
#   SCALE=1.5 SELECT_LINE=12 scripts/screenshot.sh

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$HERE/.."
OUT="${1:-$THEME_DIR/screenshot.png}"
THEME_NAME="larsmagnus/dev dark"
SCALE="${SCALE:-1.5}"
SELECT_LINE="${SELECT_LINE:-12}"

CLEAN=/tmp/vscode-clean-theme
USER_DIR="$CLEAN/user"
EXT_DIR="$CLEAN/ext/larsmagnus.larsmagnus-dev-theme-dev"
WORK_DIR="$CLEAN/ws"
SAMPLE="$WORK_DIR/sample.ts"

WIN_X=20
WIN_Y=30
WIN_W="$(awk -v s="$SCALE" 'BEGIN { printf "%d", 784 * s }')"
WIN_H="$(awk -v s="$SCALE" 'BEGIN { printf "%d", 580 * s }')"
# VS Code zoom steps are powers of 1.2.
ZOOM="$(awk -v s="$SCALE" 'BEGIN { print log(s) / log(1.2) }')"

command -v code >/dev/null || {
  echo "The 'code' CLI is not on PATH." >&2
  exit 1
}

# A leftover instance would keep answering `code` through its socket.
pkill -f "$USER_DIR" 2>/dev/null || true
rm -rf "$CLEAN"
mkdir -p "$USER_DIR/User" "$EXT_DIR" "$WORK_DIR"

cp "$HERE/screenshot-sample.txt" "$SAMPLE"
cp -R "$THEME_DIR/package.json" "$THEME_DIR/themes" "$EXT_DIR/"

cat > "$USER_DIR/User/settings.json" <<JSON
{
  "workbench.colorTheme": "$THEME_NAME",
  "workbench.startupEditor": "none",
  "workbench.layoutControl.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "window.commandCenter": false,
  "window.title": "\${activeEditorShort} · $THEME_NAME",
  "window.zoomLevel": $ZOOM,
  "chat.disableAIFeatures": true,
  "breadcrumbs.enabled": false,
  "editor.minimap.enabled": false,
  "editor.occurrencesHighlight": "off",
  "editor.selectionHighlight": false,
  "editor.fontSize": 14,
  "editor.fontFamily": "'Monaspace Neon Var', monospace",
  "editor.fontLigatures": "'calt', 'liga'",
  "editor.fontVariations": "'wght' 350, 'wdth' 100",
  "editor.lineHeight": 1.6,
  "editor.scrollbar.verticalScrollbarSize": 8,
  "editor.guides.indentation": true,
  "security.workspace.trust.enabled": false,
  "extensions.ignoreRecommendations": true
}
JSON

code --user-data-dir "$USER_DIR" --extensions-dir "$CLEAN/ext" --new-window "$SAMPLE"

# Matched on the main binary plus --user-data-dir: the crashpad helper also
# carries the profile path but has no --type= of its own.
PID=""
for _ in $(seq 1 30); do
  PID="$(ps -eo pid,command | grep -E "/MacOS/(Code|Electron) .*--user-data-dir" | grep -- "vscode-clean-theme/user" | grep -v -- "--type=" | grep -v grep | awk '{print $1}' | head -1 || true)"
  [ -n "$PID" ] && break
  sleep 1
done
[ -n "$PID" ] || {
  echo "Timed out waiting for the VS Code process" >&2
  exit 1
}

hasWindow=false
for _ in $(seq 1 45); do
  out="$(osascript -e "tell application \"System Events\" to return (count of windows of (first process whose unix id is $PID)) > 0" 2>&1 || true)"
  [ "$out" = "true" ] && hasWindow=true && break
  sleep 1
done
[ "$hasWindow" = "true" ] || {
  echo "Timed out waiting for the window (last osascript output: $out)" >&2
  exit 1
}

# Lets the TypeScript server report its diagnostics before the shot.
sleep 5

# Cmd+L selects the whole line, to show the selection color.
osascript <<OSA
tell application "System Events"
  set targetProcess to first process whose unix id is $PID
  set frontmost of targetProcess to true
  set targetWindow to window 1 of targetProcess
  perform action "AXRaise" of targetWindow
  delay 0.3
  set position of targetWindow to {$WIN_X, $WIN_Y}
  set size of targetWindow to {$WIN_W, $WIN_H}
  delay 0.5
  tell targetProcess
    keystroke "g" using control down
    delay 0.5
    keystroke "$SELECT_LINE"
    key code 36
    delay 0.3
    keystroke "l" using command down
    delay 0.3
  end tell
end tell
OSA
sleep 2

# Quartz's window list, not AX, gives the CGWindowID that screencapture needs.
# Same-PID helper surfaces exist, so the title is matched as well.
ID_SCRIPT="$CLEAN/window-id.js"
cat > "$ID_SCRIPT" <<JS
ObjC.import('CoreGraphics')
ObjC.import('CoreFoundation')
var list = \$.CGWindowListCopyWindowInfo(0, 0)
var count = \$.CFArrayGetCount(list)
var found = null
for (var i = 0; i < count; i++) {
  var info = ObjC.deepUnwrap(ObjC.castRefToObject(\$.CFArrayGetValueAtIndex(list, i)))
  if (info && info['kCGWindowOwnerPID'] === $PID && info['kCGWindowLayer'] === 0 && (info['kCGWindowName'] || '').indexOf('sample.ts') !== -1) {
    found = info['kCGWindowNumber']
    break
  }
}
String(found)
JS
WINDOW_ID="$(osascript -l JavaScript "$ID_SCRIPT")"
[ "$WINDOW_ID" != "null" ] || {
  echo "No quartz window for pid $PID (Screen Recording permission?)" >&2
  exit 1
}

screencapture -x -l"$WINDOW_ID" "$OUT"

osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID) to keystroke \"q\" using command down" >/dev/null 2>&1 || true
echo "Done: $OUT"
