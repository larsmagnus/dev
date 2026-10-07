/**
 * Claude Code docs-review hook (PostToolUse)
 * Flags inline comments introduced by an edit so Claude reviews them against
 * CLAUDE.md's Code comments rules via the `docs-architect` agent, instead of
 * letting low-value comments slip through unreviewed.
 *
 * Centralized here so every repo can share one copy: wire it up globally in
 * `~/.claude/settings.json` (see this directory's README) rather than in a
 * single project's `.claude/settings.local.json`.
 *
 * @example Wiring it up in `~/.claude/settings.json`:
 *
 * {
 *   "hooks": {
 *     "PostToolUse": [
 *       {
 *         "matcher": "Edit|Write",
 *         "hooks": [
 *           { "type": "command", "command": "node --no-warnings ~/.claude/hooks/docs-review/index.mts" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Claude Code pipes the tool-call payload into the command's stdin. For an
 * `Edit`, only a comment actually added or changed by `new_string` (relative
 * to `old_string`) triggers a flag - a full-file rescan would renag on every
 * touch to a file that already has legitimate, previously-reviewed TSDoc
 * blocks elsewhere. A `Write` has no prior state to diff against, so any
 * comment in `content` triggers a flag.
 */
import { readFileSync } from 'node:fs'

import { z } from 'zod'

const payloadSchema = z.object({
	tool_input: z.union([
		z.object({
			file_path: z.string(),
			new_string: z.string(),
			old_string: z.string(),
		}),
		z.object({ file_path: z.string(), content: z.string() }),
	]),
})

// Comment detection only needs to trigger a review, not judge quality - a
// heuristic that occasionally over-fires costs one extra (idempotent) review.
const LINE_COMMENT = /(?:^|\s)\/\/.*/g
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g

function commentsIn(source: string): string[] {
	return [
		...(source.match(LINE_COMMENT) ?? []),
		...(source.match(BLOCK_COMMENT) ?? []),
	]
}

// No stdin, malformed JSON, or an unexpected shape just means there's
// nothing to check - fail open rather than crash the hook.
function parseStdinPayload(): z.infer<typeof payloadSchema> | undefined {
	try {
		const result = payloadSchema.safeParse(JSON.parse(readFileSync(0, 'utf-8')))
		return result.success ? result.data : undefined
	} catch {
		return undefined
	}
}

const payload = parseStdinPayload()
if (!payload) process.exit(0)

const { tool_input: input } = payload
const addedComments =
	'content' in input
		? commentsIn(input.content)
		: commentsIn(input.new_string).filter(
				(comment) => !commentsIn(input.old_string).includes(comment)
			)

if (addedComments.length === 0) process.exit(0)

// Exit code 2 is what surfaces this stderr message back to Claude as feedback.
console.error(
	`New or changed inline comment(s) in ${input.file_path}:\n` +
		addedComments.map((comment) => `  - ${comment.trim()}`).join('\n') +
		'\nInvoke the docs-architect agent (Agent tool, subagent_type: "docs-architect") to review ' +
		"just these comments against CLAUDE.md's Code comments rules, and fix or remove any that " +
		"don't hold up. Don't expand the review beyond comments in this file."
)
process.exit(2)
