/**
 * Claude Code code complexity hook (PostToolUse)
 * Warns when an edited file has grown too complex (via fta-cli),
 * so it can be improved before complexity compounds further.
 *
 * Runs with `cwd` at the project root - that's what `fta.json` is resolved
 * relative to below, so a project can override the bundled default just by
 * adding its own.
 *
 * Overriding the score cap via `-s`/`--score-cap`:
 * `node --no-warnings complexity.mts --score-cap 70`
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, matchesGlob, sep } from 'node:path'

import { runFta } from 'fta-cli'
import type { AnalyzedFile } from 'fta-cli'
import { z } from 'zod'

import { readPayload } from './payload.mts'

/**
 * Last-resort cap, used only when no `fta.json` (project or bundled) is found.
 */
const DEFAULT_SCORE_CAP = 50

/**
 * The subset of fta's config this hook honours. Strict on purpose: fta itself
 * parses `fta.json` with `unwrap_or_default()` and serde ignores unknown fields,
 * so a typo like `score_cop` silently reverts the cap to fta's default of 1000
 * and CI goes green enforcing nothing. Throwing here is the only place that
 * mistake becomes visible.
 */
const configSchema = z.strictObject({
	score_cap: z.number().optional(),
	exclude_directories: z.array(z.string()).optional(),
	exclude_filenames: z.array(z.string()).optional(),
})

/**
 * A project's own `fta.json` (at its root, since that's where the hook's
 * `cwd` lands) wins; otherwise fall back to the generic default bundled
 * alongside this script.
 */
function resolveConfigPath(): string {
	const projectConfig = join(process.cwd(), 'fta.json')
	if (existsSync(projectConfig)) return projectConfig
	return join(import.meta.dirname, 'fta.json')
}

function readConfig(): z.infer<typeof configSchema> {
	const configPath = resolveConfigPath()
	if (!existsSync(configPath)) return {}
	return configSchema.parse(JSON.parse(readFileSync(configPath, 'utf-8')))
}

// Mirrors fta-cli's own `-s, --score-cap` flag so both tools share one vocabulary.
function parseScoreCap(argv: string[]): number | undefined {
	const flagIndex = argv.findIndex(
		(arg) => arg === '--score-cap' || arg === '-s'
	)
	if (flagIndex === -1) return undefined

	const value = Number(argv[flagIndex + 1])
	return Number.isFinite(value) ? value : undefined
}

/**
 * Whether `fta.json` excludes this file. `runFta` only ever forwards `--json` to
 * the binary, so the config never reaches it on the hook path - without this the
 * hook would nag on every edit to a directory or file the project's rules exempt.
 *
 * Directories match as a path segment anywhere in the file's path: fta anchors
 * them to whatever root a project analyses, which the hook can't know. Filename
 * patterns are globs on the basename.
 */
function isExcluded(
	filePath: string,
	{
		exclude_directories = [],
		exclude_filenames = [],
	}: z.infer<typeof configSchema>
): boolean {
	return (
		exclude_directories.some((directory) =>
			filePath.includes(join(sep, directory) + sep)
		) ||
		exclude_filenames.some((pattern) =>
			matchesGlob(basename(filePath), pattern)
		)
	)
}

const config = readConfig()
const scoreCap =
	parseScoreCap(process.argv.slice(2)) ?? config.score_cap ?? DEFAULT_SCORE_CAP
const filePath = readPayload()?.tool_input.file_path

if (!filePath || !existsSync(filePath)) {
	process.exit(0)
}

if (isExcluded(filePath, config)) {
	process.exit(0)
}

let results: AnalyzedFile[]
try {
	// fta returns `[]` for unsupported file types (e.g. markdown, css) - not an error.
	results = JSON.parse(runFta(filePath, { json: true }))
} catch {
	process.exit(0)
}

const result = results[0]
if (!result || result.fta_score <= scoreCap) {
	process.exit(0)
}

// Exit code 2 is what surfaces this stderr message back to Claude as feedback.
console.error(
	`Complexity check: ${filePath} scored ${result.fta_score.toFixed(1)} (${result.assessment}, ${result.line_count} lines) — above the cap of ${scoreCap}.\n` +
		'Simplify the implementation or extract smaller modules before continuing.'
)
process.exit(2)
