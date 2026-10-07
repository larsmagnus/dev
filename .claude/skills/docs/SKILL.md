---
name: docs
description: Review docs and inline comments against CLAUDE.md via the docs-architect agent - the current diff, a PR number, a branch/commit, or a path. Reports findings by default; pass --fix to apply them directly. Use when the user wants a docs or comment review, invokes /docs, or asks to check comment/doc quality.
argument-hint: '[target] [--fix] - target is a path, branch/commit, or PR number; nothing reviews the current diff, report-only'
agent: docs-architect
context: fork
---

# Docs Review

Resolves what to review, then hands it straight to `docs-architect` — no rules live here. See `docs-architect` itself and CLAUDE.md's Prose/Code comments sections for those; this skill is only about scope and mode.

## Target

Parse the arguments for a target and a `--fix` flag, in any order.

- No target: the current session's uncommitted changes — `git diff --name-only HEAD`, plus untracked files from `git status --porcelain`.
- A commit/branch/tag: everything since that fixed point — `git diff --name-only <target>...HEAD`, the same convention as `/code-review`.
- A number: a PR — fetch its changed files (`gh pr diff <target> --name-only`).
- A path or glob: that file/directory directly, regardless of diff state.

Confirm the target resolves (e.g. `git rev-parse` for a ref) and the file list isn't empty before reviewing. Ask the user rather than guessing if the target is ambiguous.

## Mode

- Default: report findings only — file, what's wrong, why. Make no changes.
- `--fix` present in the arguments: apply the changes directly to the working tree, then report a brief summary of what changed.
