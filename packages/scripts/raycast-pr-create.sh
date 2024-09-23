#!/bin/bash

# TODO: this is just a test script

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Show PR Info
# Modes changes the UI: silent | inline | compact | fullOutput
# @see {@link https://github.com/raycast/script-commands/blob/master/documentation/OUTPUTMODES.md Raycast output modes}
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 🤖
# @raycast.argument1 { "type": "text", "placeholder": "Issue number" }
# @raycast.packageName PR Utils

# Documentation:
# @raycast.description This is just a test
# @raycast.author larsmagnus
# @raycast.authorURL https://raycast.com/larsmagnus
# @raycast.currentDirectoryPath ~/sites/fullstack-components
color_green="\033[0;32m"
font_bold="\033[1m"
style_none="\033[0m" # No formatting or colours

branch_base=${BASE_BRANCH:-origin/main}
lines_stat=$(git diff --shortstat "$branch_base" | xargs)
lines_changed=$(echo "$lines_stat" | awk '{print $4 + $6}')

# Get body messages from staged commits only
commit_messages=$(git log "$branch_base"..HEAD --oneline --pretty=format:%b)
# Format commit messages: remove empty lines | remove duplicate dashes | remove leading spaces | add dash to lines that don't start with a dash
commit_messages_formatted=$(echo "$commit_messages" | sed '/^[[:space:]]*$/d' | sed 's/^- \+/- /' | sed 's/^ \+//g' | sed 's/^[^-]/- &/')

# TODO: placeholder
pr_url=https://github.com/pulls/
silent_mode=true
for arg in "$@"; do
	if [[ "$arg" == "--silent" || "$arg" == "-s" ]]; then
		silent_mode=true
		break
	fi
done

echo -e "🚀 ${color_green}${font_bold}PR $1 created!${style_none}"
echo -e "$pr_url\n"
echo "$lines_stat"
echo -e "Total lines changed $lines_changed\n"
echo -e "${commit_messages_formatted//\\n/\\n- }\n\nCloses #$1"

# Step 10: Conditionally open the URL in the browser if not in silent mode
if [ "$silent_mode" = false ]; then
	open "$pr_url" # macOS: uses 'open'. On Linux, use 'xdg-open', and on Windows, use 'start'.
fi
