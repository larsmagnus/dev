#!/bin/bash

# You can pass the repo dynamically instead of hardcoding 'owner/repo'
repo=${GITHUB_REPO:-owner/repo}
branch_base=${BASE_BRANCH:-origin/main}
# Determine the directory of the current script (create-pr.sh)
cwd=$(dirname "$(realpath "$0")")

# Check for the --silent or -s flag
silent_mode=false

for arg in "$@"; do
	if [[ "$arg" == "--silent" || "$arg" == "-s" ]]; then
		silent_mode=true
		break
	fi
done

# Ensure issue number is provided as an argument
if [ -z "$1" ]; then
	echo "Error: Issue number is required."
	exit 1
fi

issue_number=$1

# Get issue details using GitHub CLI
issue_details=$(gh issue view "$issue_number" --json title,labels,milestone --jq "{title: .title, type: .labels[0].name, milestone: .milestone.title}")
issue_title=$(echo "$issue_details" | jq -r '.title')
issue_type=$(echo "$issue_details" | jq -r '.type')
label=${issue_type:-chore}
milestone=$(echo "$issue_details" | jq -r '.milestone')

# Get the commit messages for the staged commits
# --pretty=format:%b gets only the body copy, as-is
# use %B to get both the title and the body
commit_messages=$(git log "$branch_base"..HEAD --oneline --pretty=format:%b)

# Format commit messages
# remove empty lines
# remove duplicate dashes
# remove leading spaces
# add dash to lines that don't start with a dash
commit_messages_formatted=$(echo "$commit_messages" | sed '/^[[:space:]]*$/d' | sed 's/^- \+/- /' | sed 's/^ \+//g' | sed 's/^[^-]/- &/')

# Calculate the diff stats
# For both full stats and total lines changed
lines_stat=$(git diff --shortstat "$branch_base" | xargs)

# Extract the total lines changed
# (additions + deletions) from the diff stats
lines_changed=$(echo "$lines_stat" | awk '{print $4 + $6}')

# Determine PR size based on lines changed
pr_size=$("$cwd"/pr-calculate-size.sh "$lines_changed")

# Format the PR title
# @example PR title
# feat: 1872 Add more cowbell
pr_title="$issue_type: $issue_number $issue_title"
# Prepare the PR body
# `Closes #n` uses a keyword to link the PR to an issue
pr_body=$(printf "%s\n\nCloses #%s", "$commit_messages_formatted", "$issue_number")

# The branch needs to be pushed before a PR can be created
git push

# Create the PR using the GitHub CLI
# https://cli.github.com/manual/gh_pr_create
pr_url=$(gh pr create --title "$pr_title" --body "$pr_body" --assignee @me --label "$label" --repo "$repo" --milestone "$milestone" --dry-run)
# TODO: use gh label list --search <text> to search for part of the branchname
# chore/jest-config-teamname <- this could be a convention
# then I just split the branch name and pick out the last part to use as the search query
# alternatively:
# allow passing a -c or --interactive / -i flag to create-pr 123 -i making it interactive
# this could allow me to preview it, and add labels from a list...

# Output PR info and URL
"$cwd"/pr-output-info.sh "$pr_url" "$pr_size" "$issue_title" "$lines_changed" "$lines_stat" "$silent_mode"
