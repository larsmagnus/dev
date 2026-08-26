/**
 * Claude Code format hook (PostToolUse)
 * Auto-fixes and formats the edited file with the project's own oxlint and
 * oxfmt, then hands any lint errors those tools couldn't fix back to Claude,
 * so a turn ends with formatted, lint-clean code instead of a cleanup pass later.
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
 *           { "type": "command", "command": "node --no-warnings ~/.claude/hooks/format/index.mts" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Claude Code pipes the tool-call payload (including the edited file's path)
 * into the command's stdin, and runs the command with `cwd` set to the project
 * root. Both binaries discover their own config (`.oxlintrc.json`, `.oxfmtrc.json`)
 * from there, including nested configs in subdirectories, so the project's rules
 * apply with no wiring.
 *
 * Unlike the complexity and duplication hooks, this one rewrites files - so it
 * only ever runs binaries installed in the target project, never the copies
 * living alongside this script. A different oxfmt version or a default config
 * would reformat the whole file against the project's conventions.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { z } from 'zod'

const payloadSchema = z.object({
	session_id: z.string().optional(),
	tool_input: z.object({ file_path: z.string() }),
})

// Any failure here (no stdin, malformed JSON, unexpected shape) just means
// there's nothing to format - fail open rather than crash the hook.
function readPayload(): z.infer<typeof payloadSchema> | undefined {
	try {
		const parsed = payloadSchema.safeParse(JSON.parse(readFileSync(0, 'utf-8')))
		return parsed.success ? parsed.data : undefined
	} catch {
		return undefined
	}
}

/**
 * Nearest installed binary, searching from the edited file upward. Starting at
 * the file rather than the project root is what makes this correct in a
 * monorepo, where a package can pin its own oxlint alongside the workspace's.
 */
function findUp(relativePath: string, from: string): string | undefined {
	let directory = from
	while (true) {
		const candidate = join(directory, relativePath)
		if (existsSync(candidate)) return candidate

		const parent = dirname(directory)
		if (parent === directory) return undefined
		directory = parent
	}
}

/**
 * Warns at most once per session per project. A missing install is worth
 * saying out loud - the silent `|| true` version of this hook is indis-
 * tinguishable from one that never ran - but not on every single edit.
 */
function warnOnce(
	sessionId: string,
	project: string,
	message: string
): boolean {
	const key = createHash('sha1').update(project).digest('hex').slice(0, 8)
	const marker = join(tmpdir(), `claude-format-hook-${sessionId}-${key}`)
	if (existsSync(marker)) return false

	writeFileSync(marker, '')
	console.error(message)
	return true
}

function run(bin: string, args: string[]): { ok: boolean; output: string } {
	const result = spawnSync(bin, [...args, '--no-error-on-unmatched-pattern'], {
		cwd: process.cwd(),
		encoding: 'utf-8',
	})
	return {
		ok: result.status === 0,
		output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
	}
}

const payload = readPayload()
if (!payload) process.exit(0)

const filePath = resolve(payload.tool_input.file_path)
if (!existsSync(filePath)) process.exit(0)

const fromDirectory = dirname(filePath)
const oxlint = findUp(join('node_modules', '.bin', 'oxlint'), fromDirectory)
const oxfmt = findUp(join('node_modules', '.bin', 'oxfmt'), fromDirectory)

if (!oxlint || !oxfmt) {
	// No package.json anywhere up the tree means this isn't a JS project at all
	// (a stray script, a scratch file) - nothing to complain about.
	const manifest = findUp('package.json', fromDirectory)
	if (!manifest) process.exit(0)

	const project = dirname(manifest)
	const warned = warnOnce(
		payload.session_id ?? 'no-session',
		project,
		`Format hook skipped: ${oxlint ? 'oxfmt' : 'oxlint'} is not installed in ${project}.\n` +
			'Install both as devDependencies to format and auto-fix on every edit.'
	)

	// A non-zero exit other than 2 is what puts the warning in front of me
	// rather than Claude; staying silent once warned keeps it to one notice.
	process.exit(warned ? 1 : 0)
}

// Lint first, format second: formatting the result of an auto-fix, rather than
// the other way round, is what leaves the file in a settled state.
const lint = run(oxlint, ['--fix', filePath])
const format = run(oxfmt, [filePath])

const failures = [lint, format].filter(({ ok }) => !ok)
if (failures.length === 0) process.exit(0)

// Exit code 2 is what surfaces this stderr message back to Claude as feedback.
console.error(
	`Lint issues remain in ${filePath} after auto-fix:\n` +
		failures.map(({ output }) => output).join('\n') +
		'\nFix them before continuing.'
)
process.exit(2)
