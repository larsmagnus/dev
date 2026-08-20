/**
 * Claude Code duplication hook (PostToolUse)
 * Warns when the edited file shares a duplicated block with another file
 * (via jscpd), so near-identical code can be extracted before it spreads
 * further.
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
 *           { "type": "command", "command": "node --no-warnings ~/.claude/hooks/check-duplication.mts" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Claude Code pipes the tool-call payload (including the edited file's path)
 * into the command's stdin, and runs the command with `cwd` set to the
 * project root. A project's own `.jscpd.json` at that root is the source of
 * truth for what gets scanned and ignored - this hook re-scans the whole
 * project (jscpd's own native binary does this in ~20-30ms) rather than
 * re-implementing its ignore rules, and simply filters the report for clones
 * touching the edited file. A project without its own `.jscpd.json` falls
 * back to the generic default bundled alongside this script.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

import { z } from 'zod'

const payloadSchema = z.object({
	tool_input: z.object({ file_path: z.string() }),
})

const cloneLocationSchema = z.object({
	name: z.string(),
	startLoc: z.object({ line: z.number() }),
	endLoc: z.object({ line: z.number() }),
})

const reportSchema = z.object({
	duplicates: z.array(
		z.object({
			firstFile: cloneLocationSchema,
			secondFile: cloneLocationSchema,
		})
	),
})

const jscpdConfigSchema = z.object({
	path: z.array(z.string()).optional(),
})

/**
 * A project's own `.jscpd.json` (at its root, since that's where the hook's
 * `cwd` lands) wins; otherwise fall back to the generic default bundled
 * alongside this script. `isBundled` matters for how the scan root is
 * resolved below.
 */
function resolveConfig(root: string): { path: string; isBundled: boolean } {
	const projectConfig = join(root, '.jscpd.json')
	if (existsSync(projectConfig))
		return { path: projectConfig, isBundled: false }
	return { path: join(import.meta.dirname, '.jscpd.json'), isBundled: true }
}

/**
 * jscpd resolves a config's `path` relative to the config *file's own*
 * directory, not `cwd` - harmless for a project's own `.jscpd.json` (which
 * lives at `root`, so the two coincide), but would scan this script's own
 * directory for the config bundled here. Passing `root` as an explicit CLI
 * path argument overrides that resolution and is what jscpd then reports
 * clone locations relative to.
 */
function resolveScanRoot(
	root: string,
	config: { path: string; isBundled: boolean }
): string {
	if (config.isBundled) return root
	try {
		const parsed = jscpdConfigSchema.parse(
			JSON.parse(readFileSync(config.path, 'utf-8'))
		)
		return join(root, parsed.path?.[0] ?? '.')
	} catch {
		return root
	}
}

// Any failure here (no stdin, malformed JSON, unexpected shape) just means
// there's nothing to check - fail open rather than crash the hook.
function readFilePathFromStdin(): string | undefined {
	try {
		const raw = readFileSync(0, 'utf-8')
		const parsed = payloadSchema.safeParse(JSON.parse(raw))
		return parsed.success ? parsed.data.tool_input.file_path : undefined
	} catch {
		return undefined
	}
}

function describeClone(
	other: z.infer<typeof cloneLocationSchema>,
	edited: z.infer<typeof cloneLocationSchema>
): string {
	return `${edited.name}:${edited.startLoc.line}-${edited.endLoc.line} duplicates ${other.name}:${other.startLoc.line}-${other.endLoc.line}`
}

const filePath = readFilePathFromStdin()
if (!filePath || !existsSync(filePath)) {
	process.exit(0)
}

const ROOT = process.cwd()
const config = resolveConfig(ROOT)
const relativeToScanRoot = relative(
	resolveScanRoot(ROOT, config),
	resolve(filePath)
)

const outDir = mkdtempSync(join(tmpdir(), 'jscpd-hook-'))
try {
	// Resolved through Node's own module system rather than a hardcoded
	// `node_modules/.bin/jscpd` path, so this keeps working regardless of how
	// the package manager lays out `.bin` (npm, yarn, pnpm workspaces, ...).
	// jscpd v5 has no Node API to import instead - it ships this launcher
	// script as its only entry point, which execs a platform-specific native
	// binary. Resolved inside the try so a missing install falls through to
	// the same fail-open catch below, rather than crashing the hook. Resolved
	// relative to this script's own location (where jscpd is actually
	// installed), not the target project's.
	const jscpdBin = createRequire(import.meta.url).resolve('jscpd/run-jscpd.js')

	// The bundled config's `path` needs an explicit override (see
	// `resolveScanRoot`'s doc comment) to scan the project rather than this
	// script's own directory; a project's own config is left to resolve its
	// own `path` as authored.
	const pathArgs = config.isBundled ? [ROOT] : []

	execFileSync(
		process.execPath,
		[jscpdBin, ...pathArgs, '-c', config.path, '-r', 'json', '-o', outDir],
		{ cwd: ROOT, stdio: 'ignore' }
	)

	const report = reportSchema.parse(
		JSON.parse(readFileSync(join(outDir, 'jscpd-report.json'), 'utf-8'))
	)

	const messages = report.duplicates.flatMap(({ firstFile, secondFile }) => {
		if (firstFile.name === relativeToScanRoot)
			return [describeClone(secondFile, firstFile)]
		if (secondFile.name === relativeToScanRoot)
			return [describeClone(firstFile, secondFile)]
		return []
	})

	if (messages.length === 0) process.exit(0)

	// Exit code 2 is what surfaces this stderr message back to Claude as feedback.
	console.error(
		`Duplication check found ${messages.length} clone(s) involving ${filePath}:\n` +
			messages.map((message) => `  - ${message}`).join('\n') +
			'\nExtract the shared code into a function, or leave it if the repeat is unavoidable boilerplate.'
	)
	process.exit(2)
} catch {
	// jscpd not installed, report missing, or scan failed - nothing to check.
	process.exit(0)
} finally {
	rmSync(outDir, { recursive: true, force: true })
}
