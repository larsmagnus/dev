/**
 * Claude Code format hook (PostToolUse)
 * Auto-fixes and formats the edited file with oxlint and oxfmt, then hands any
 * lint errors those tools couldn't fix back to Claude, so a turn ends with
 * formatted, lint-clean code instead of a cleanup pass later.
 *
 * Both binaries discover their own config (`.oxlintrc.json`, `.oxfmtrc.json`)
 * from the project root, including nested configs in subdirectories, so the
 * project's rules apply with no wiring. This one rewrites files, so the
 * project's own binaries win over the plugin's: a different oxfmt version
 * would reformat the whole file against another set of conventions. The
 * plugin's copies are only a fallback for projects that install neither.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { readPayload } from './payload.mts'

const BIN_DIRECTORY = join('node_modules', '.bin')
const BUNDLED_BIN_DIRECTORY = join(import.meta.dirname, '..', BIN_DIRECTORY)

/**
 * The project's own binary if it has one, else the plugin's installed copy.
 */
function findBin(name: string, from: string): string | undefined {
	const bundled = join(BUNDLED_BIN_DIRECTORY, name)
	return (
		findUp(join(BIN_DIRECTORY, name), from) ??
		(existsSync(bundled) ? bundled : undefined)
	)
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
const oxlint = findBin('oxlint', fromDirectory)
const oxfmt = findBin('oxfmt', fromDirectory)

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
