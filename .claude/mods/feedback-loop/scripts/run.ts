#!/usr/bin/env node
/** Headless worker. The launchd job, session hooks and pane all start it, and the lock lets them fire freely. */
import { mkdir, rm } from 'node:fs/promises'

import { collect } from './collect.ts'
import { acquireLock } from './lock.ts'
import { parseResolution, resolveSelection } from './resolve.ts'
import { installSchedule } from './schedule.ts'
import { FILES, log } from './store.ts'

async function main(command: string | undefined, args: string[]) {
	await mkdir(FILES.queue, { recursive: true })
	if (command === 'install-schedule') return installSchedule()
	if (command !== 'collect' && command !== 'resolve')
		throw new Error(
			'usage: run.ts collect [--force] | resolve <json> | install-schedule'
		)

	if (!(await acquireLock())) {
		// A resolve the user asked for must not look done when a run held the lock.
		if (command === 'resolve') {
			await log('resolve skipped: a run is in progress')
			process.exitCode = 75
		}
		return
	}

	try {
		if (command === 'collect') await collect(args.includes('--force'))
		else console.log(await resolveSelection(parseResolution(args[0] ?? '')))
	} catch (error) {
		await log(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	} finally {
		await rm(FILES.lock, { force: true })
	}
}

await main(process.argv[2], process.argv.slice(3))
