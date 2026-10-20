// oxlint-disable typescript/no-floating-promises
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const pluginsDir = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.stringify({
	name: '@larsmagnus/plugin',
	dependencies: { 'fta-cli': '3.1.0' },
})
const upgradedManifest = JSON.stringify({
	name: '@larsmagnus/plugin',
	dependencies: { 'fta-cli': '3.2.0' },
})

// Stands in for npm: logs each call, installs fta-cli into --prefix, or fails when offline.
const fakeNpm = `#!/bin/sh
echo "$@" >> "$FAKE_NPM_LOG"
[ -n "$FAKE_NPM_OFFLINE" ] && { echo "npm error network request to registry.npmjs.org failed" >&2; exit 1; }
while [ "$1" != "--prefix" ]; do shift; done
mkdir -p "$2/node_modules/fta-cli"
echo '{"name":"fta-cli"}' > "$2/node_modules/fta-cli/package.json"
`

let sandbox: string

before(() => {
	sandbox = mkdtempSync(join(tmpdir(), 'plugin-install-'))
	mkdirSync(join(sandbox, 'bin'))
	writeFileSync(join(sandbox, 'bin', 'npm'), fakeNpm, { mode: 0o755 })
})

after(() => rmSync(sandbox, { recursive: true, force: true }))

/** Creates an isolated plugin root and data dir, and runs the installer against them. */
function setup(plugin: string, rootManifest = manifest) {
	const dir = mkdtempSync(join(sandbox, `${plugin}-`))
	const root = join(dir, 'root')
	const data = join(dir, 'data')
	const npmLog = join(dir, 'npm.log')
	mkdirSync(root)
	mkdirSync(data)
	writeFileSync(join(root, 'package.json'), rootManifest)
	writeFileSync(npmLog, '')

	const run = (options: { offline?: boolean; nodeArgs?: string[] } = {}) =>
		spawnSync(
			process.execPath,
			[
				...(options.nodeArgs ?? []),
				join(pluginsDir, plugin, 'scripts', 'install.mjs'),
			],
			{
				encoding: 'utf-8',
				env: {
					...process.env,
					PATH: `${join(sandbox, 'bin')}:${process.env.PATH}`,
					CLAUDE_PLUGIN_ROOT: root,
					CLAUDE_PLUGIN_DATA: data,
					FAKE_NPM_LOG: npmLog,
					FAKE_NPM_OFFLINE: options.offline ? '1' : '',
				},
			}
		)
	const npmCalls = () =>
		readFileSync(npmLog, 'utf-8').split('\n').filter(Boolean)

	return { root, data, run, npmCalls }
}

for (const plugin of ['code-quality', 'docs-review']) {
	describe(`${plugin} install script`, () => {
		it('should install dependencies and link them into the plugin root on first run', () => {
			const { root, data, run, npmCalls } = setup(plugin)

			const result = run()

			assert.equal(result.status, 0)
			assert.equal(npmCalls().length, 1)
			assert.match(npmCalls()[0], /^install --prefix \S+ /)
			assert.ok(
				existsSync(join(data, 'node_modules', 'fta-cli', 'package.json'))
			)
			assert.equal(
				readFileSync(join(data, 'installed-package.json'), 'utf-8'),
				manifest
			)
			assert.equal(
				readlinkSync(join(root, 'node_modules')),
				join(data, 'node_modules')
			)
			assert.ok(
				existsSync(join(root, 'node_modules', 'fta-cli', 'package.json'))
			)
		})

		it('should not run npm again when the manifest is unchanged', () => {
			const { run, npmCalls } = setup(plugin)
			run()

			const result = run()

			assert.equal(result.status, 0)
			assert.equal(npmCalls().length, 1)
		})

		it('should reinstall when the manifest has changed', () => {
			const { root, data, run, npmCalls } = setup(plugin)
			run()
			writeFileSync(join(root, 'package.json'), upgradedManifest)

			const result = run()

			assert.equal(result.status, 0)
			assert.equal(npmCalls().length, 2)
			assert.equal(
				readFileSync(join(data, 'installed-package.json'), 'utf-8'),
				upgradedManifest
			)
		})

		it('should exit 0, print a retry message and retry next session when npm fails offline', () => {
			const { data, run, npmCalls } = setup(plugin)

			const offline = run({ offline: true })

			assert.equal(offline.status, 0)
			assert.match(
				offline.stderr,
				/registry\.npmjs\.org failed.*Retrying next session/
			)
			assert.equal(existsSync(join(data, 'installed-package.json')), false)

			const retry = run()

			assert.equal(retry.status, 0)
			assert.equal(npmCalls().length, 2)
			assert.ok(existsSync(join(data, 'installed-package.json')))
		})

		it('should leave an existing real node_modules directory in the plugin root alone', () => {
			const { root, run } = setup(plugin)
			const workspaceModules = join(root, 'node_modules')
			mkdirSync(join(workspaceModules, 'oxlint'), { recursive: true })
			writeFileSync(join(workspaceModules, 'oxlint', 'package.json'), '{}')

			const result = run()

			assert.equal(result.status, 0)
			assert.equal(lstatSync(workspaceModules).isSymbolicLink(), false)
			assert.ok(existsSync(join(workspaceModules, 'oxlint', 'package.json')))
			assert.equal(existsSync(join(workspaceModules, 'fta-cli')), false)
		})

		it('should replace a stale node_modules symlink with one to the data directory', () => {
			const { root, data, run } = setup(plugin)
			const staleTarget = join(root, '..', 'removed-data', 'node_modules')
			symlinkSync(staleTarget, join(root, 'node_modules'))

			const result = run()

			assert.equal(result.status, 0)
			assert.equal(
				readlinkSync(join(root, 'node_modules')),
				join(data, 'node_modules')
			)
			assert.ok(
				existsSync(join(root, 'node_modules', 'fta-cli', 'package.json'))
			)
		})

		it('should warn and skip the install on a Node older than 22.18', () => {
			const { root, data, run, npmCalls } = setup(plugin)
			const spoofOldNode = `data:text/javascript,Object.defineProperty(process.versions,'node',{value:'20.11.0'})`

			const result = run({ nodeArgs: ['--import', spoofOldNode] })

			assert.equal(result.status, 0)
			assert.match(result.stderr, /need Node >=22\.18.*found 20\.11\.0/)
			assert.equal(npmCalls().length, 0)
			assert.equal(existsSync(join(data, 'installed-package.json')), false)
			assert.equal(existsSync(join(root, 'node_modules')), false)
		})
	})
}
