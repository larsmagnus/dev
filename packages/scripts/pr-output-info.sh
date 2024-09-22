#!/bin/bash

# Ensure the necessary arguments are passed
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
	echo "Error: Missing arguments. Usage: ./pr-output-info.sh <pr_url> <pr_size> <lines_stat> <silent_mode>"
	exit 1
fi

pr_url=$1
pr_size=$2
lines_stat=$3
silent_mode=$4

# Output success message, the PR URL, PR size, and lines changed
echo "PR created! 🚀"
echo "$pr_url"
echo "$pr_size"
echo "$lines_stat"

# Conditionally open the URL in the browser if not in silent mode
if [ "$silent_mode" = false ]; then
	open "$pr_url" # macOS: uses 'open'. On Linux, use 'xdg-open', and on Windows, use 'start'.
fi
