/**
 * Installs the plugin's dependencies into its persistent data directory on
 * SessionStart, so they survive plugin updates and cost nothing after the
 * first session. Plain JavaScript on purpose: it has to run, and explain
 * itself, on a Node too old to strip types from the `.mts` hooks.
 *
 * Never fails the session: an offline first run just retries next session, and
 * the hooks stay quiet until the install lands.
 */
import { execFileSync } from 'node:child_process'
import {
	copyFileSync,
	existsSync,
	lstatSync,
	readFileSync,
	readlinkSync,
	symlinkSync,
	unlinkSync,
} from 'node:fs'
import { join } from 'node:path'

const [MIN_MAJOR, MIN_MINOR] = [22, 18]
const { CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: data } = process.env

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
	console.error(
		`Plugin hooks need Node >=${MIN_MAJOR}.${MIN_MINOR} to run TypeScript directly; found ${process.versions.node}.`
	)
	process.exit(0)
}
if (!root || !data) process.exit(0)

const manifest = join(root, 'package.json')
const installedManifest = join(data, 'installed-package.json')
const modules = join(data, 'node_modules')

const isCurrent =
	existsSync(modules) &&
	existsSync(installedManifest) &&
	readFileSync(installedManifest, 'utf-8') === readFileSync(manifest, 'utf-8')

if (!isCurrent) {
	try {
		copyFileSync(manifest, join(data, 'package.json'))
		execFileSync(
			'npm',
			['install', '--prefix', data, '--omit=dev', '--no-audit', '--no-fund'],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		)
		copyFileSync(manifest, installedManifest)
	} catch (error) {
		const reason = String(error.stderr || error.message)
			.trim()
			.split('\n')
			.at(-1)
		console.error(
			`Plugin dependency install failed: ${reason}. Retrying next session.`
		)
		process.exit(0)
	}
}

// Node resolves bare imports from the importing file's directory upwards, and
// the plugin root is the only place the hooks can be given a `node_modules`.
// A real directory there (a workspace install in development) is left alone,
// and a correct link is left untouched so a parallel session never sees it gone.
const link = join(root, 'node_modules')
const linkModules = () => {
	const existing = lstatSync(link, { throwIfNoEntry: false })
	if (existing && !existing.isSymbolicLink()) return
	if (existing && readlinkSync(link) === modules) return
	if (existing) unlinkSync(link)
	symlinkSync(modules, link)
}
try {
	linkModules()
} catch (error) {
	console.error(`Could not link plugin dependencies: ${error.message}`)
}
