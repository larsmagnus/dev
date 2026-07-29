---
name: commit
description: Creates a GitHub pull request
allowed-tools: Bash(git log *), Bash(git add *), Bash(git commit *), Bash(git diff *)
---

# Git Commit Skill

Create many small, clear, well-formatted git commits following [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) standards.

## Usage

```
/commit
```

## Behavior

1. Analyze unstaged changes with `git diff` or staged changes with `git diff --staged`
2. Generate a conventional commit message
3. Create the commit with proper formatting

## Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

- feat: New functionality
- fix: A bug fix
- docs: Documentation-only changes (e.g., updating a README file or adding comments)
- style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding or modifying tests
- build: Changes that affect the build system or external dependencies (e.g., changes to package.json or a build script)
- chore: Other changes that don't modify source or test files
- revert: Reverts a previous commit

## Example Output

```
feat(auth): add password reset functionality

- Add forgot password form
- Implement email verification flow
- Add password reset endpoint
```
