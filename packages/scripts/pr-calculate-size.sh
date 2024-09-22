#!/bin/bash

# Check if lines_changed is passed as an argument
if [ -z "$1" ]; then
	echo "Error: lines_changed value is required."
	exit 1
fi

lines_changed=$1

# Configure the size ranges and emojis
declare -A size_map=(
	[tiny]="🐜 Tiny"
	[small]="🐤 Small"
	[medium]="🐔 Medium"
	[large]="🐘 Large"
	[huge]="🐋 Huge"
)

# Determine the size category based on lines_changed
if [ "$lines_changed" -le 10 ]; then
	pr_size="${size_map[tiny]}"
elif [ "$lines_changed" -le 50 ]; then
	pr_size="${size_map[small]}"
elif [ "$lines_changed" -le 100 ]; then
	pr_size="${size_map[medium]}"
elif [ "$lines_changed" -le 500 ]; then
	pr_size="${size_map[large]}"
else
	pr_size="${size_map[huge]}"
fi

# Output the result
echo "$pr_size ($lines_changed lines)"
