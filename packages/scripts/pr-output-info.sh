#!/bin/bash

color_green="\033[0;32m"
font_bold="\033[1m"
style_none="\033[0m" # No formatting or colours

# Ensure arguments are passed
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
	echo "Error: Missing arguments. Usage: ./pr-output-info.sh <pr_url> <pr_size> <lines_stat> <silent_mode>"
	exit 1
fi

pr_url=$1
pr_size=$2
issue_title=$3
lines_changed=$4
lines_stat=$5
silent_mode=$6

# Output details of the created PR
echo -e "\n🚀 ${color_green}${font_bold}PR $1 created!${style_none}"
echo "$pr_size - $issue_title"
echo -e "$pr_url\n"
echo -e "Total lines changed $lines_changed"
echo "$lines_stat"

# Conditionally open the URL in the browser if not in silent mode
if [ "$silent_mode" = false ]; then
	open "$pr_url" # macOS: uses 'open'. On Linux, use 'xdg-open', and on Windows, use 'start'.
fi
