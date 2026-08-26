#!/bin/sh

color_green="\033[0;32m"
font_bold="\033[1m"
style_none="\033[0m" # No formatting or colours

if [ -z "$1" ]; then
  echo "🤓👆 Usage: killport <port_number>"
  exit 1
fi

# lsof returns PIDs separated by newlines.
# Capture them as a single string instead of an array
pids=$(lsof -t -i:"$1")

if [ -z "$pids" ]; then
  echo "🫨 No process running on port $1"
  exit 0
fi

echo "🤞 Attempting graceful shutdown (SIGTERM) for PIDs: $pids on port $1..."

# Leave $pids unquoted here so the shell splits the
# string into separate args for the kill command.
# shellcheck disable=SC2086
kill -15 $pids 2>/dev/null

sleep 2

stubborn_pids=""

for pid in $pids; do
  if kill -0 "$pid" 2>/dev/null; then
    # Append surviving PIDs
    stubborn_pids="$stubborn_pids $pid"
  fi
done

if [ -n "$stubborn_pids" ]; then
  echo "😤 Processes $stubborn_pids refused to stop. 🤖🔪 Forcing termination (SIGKILL)..."
  # shellcheck disable=SC2086
  kill -9 $stubborn_pids 2>/dev/null
  echo "🔪 ${color_green}${font_bold}Done.${style_none}"
else
  echo "🧑‍🩰 ${color_green}${font_bold}Graceful shutdown successful.${style_none}"
fi
