#!/bin/bash

# Check if lines_changed is passed as an argument
if [ -z "$1" ]; then
	echo "Error: Lines changed is required."
	exit 1
fi

lines_changed=$1
pr_size="🐋 Huge PR"

# Determine the size category based on lines_changed
if [ "$lines_changed" -le 10 ]; then
	pr_size="🐜 Tiny PR"
elif [ "$lines_changed" -le 50 ]; then
	pr_size="🐤 Small PR"
elif [ "$lines_changed" -le 100 ]; then
	pr_size="🐔 Medium PR"
elif [ "$lines_changed" -le 500 ]; then
	pr_size="🐘 Large PR"
fi

echo "$pr_size ($lines_changed lines)"
