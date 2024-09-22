#!/bin/bash

# You can pass the repo dynamically instead of hardcoding 'owner/repo'
repo=${GITHUB_REPO:-owner/repo}
base_branch=${BASE_BRANCH:-origin/main}

# Step 1: Check for the --silent or -s flag
silent_mode=false

for arg in "$@"; do
	if [[ "$arg" == "--silent" || "$arg" == "-s" ]]; then
		silent_mode=true
		break
	fi
done

# Step 2: Ensure issue number is provided as an argument
if [ -z "$1" ]; then
	echo "Error: Issue number is required."
	exit 1
fi

issue_number=$1

# Step 3: Get issue details using GitHub CLI
issue_details=$(gh issue view "$issue_number" --json title,labels,milestone --jq "{title: .title, type: .labels[0].name, milestone: .milestone.title}")
issue_title=$(echo "$issue_details" | jq -r '.title')
issue_type=$(echo "$issue_details" | jq -r '.type')
milestone=$(echo "$issue_details" | jq -r '.milestone')

# Step 4: Get the commit messages for the staged commits
commit_messages=$(git log --oneline)
# --pretty=format:%b gets only the body copy, as-is
# use %B to get both the title and the body
# git log "$base_branch"..HEAD --oneline --pretty=format:%b
# get a list of recent branches
# git branch --sort=-committerdate  # DESC
# git branch --sort=committerdate  # ASC

# Step 5: Calculate the diff stats once, for both full stats and total lines changed
lines_stat=$(git diff --shortstat "$base_branch")

# Extract the total lines changed (additions + deletions) from the diff stats
lines_changed=$(echo "$lines_stat" | awk '{print $4 + $6}')

# Step 6: Call external script to determine PR size based on lines changed
pr_size=$(./pr-calculate-size.sh "$lines_changed")

# Step 7: Format the PR title and body
pr_title="$issue_type: #$issue_number $issue_title"
pr_body="- ${commit_messages//\\n/\\n- }\n\nCloses #$issue_number"

# Step 8: Create the PR using the GitHub CLI
pr_url=$(gh pr create --title "$pr_title" --body "$pr_body" --milestone "$milestone" --assignee @me --repo "$repo" --json url --jq .url)

# Step 9 and 10: Call the external script for output
./pr-output-info.sh "$pr_url" "$pr_size" "$lines_stat" "$silent_mode"
