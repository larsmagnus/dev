#!/bin/bash

# Check if the local branch is behind, ahead, or up-to-date with the remote branch
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2> /dev/null)

if [ -z "$UPSTREAM" ]; then
	echo "No upstream branch set. You haven't pushed this branch yet."
	# Optionally, push the branch if desired
	git push --set-upstream origin "$(git branch --show-current)"
else
	LOCAL=$(git rev-parse @)
	REMOTE=$(git rev-parse "@{u}")
	BASE=$(git merge-base @ "@{u}")

	if [ "$LOCAL" = "$REMOTE" ]; then
		echo "Branch is up to date with the remote."
	elif [ "$LOCAL" = "$BASE" ]; then
		echo "Branch is behind the remote. Consider pulling."
	elif [ "$REMOTE" = "$BASE" ]; then
		echo "Branch is ahead of the remote. Consider pushing."
		git push
	else
		echo "Branch has diverged from the remote."
	fi
fi
