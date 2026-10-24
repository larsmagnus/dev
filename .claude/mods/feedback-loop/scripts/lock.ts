import { rm, stat, writeFile } from 'node:fs/promises'

import { FILES } from './store.ts'

const LOCK_STALE_MS = 60 * 60 * 1000

/** Creates the lock file, failing if another run already holds it. */
const claim = () => writeFile(FILES.lock, String(process.pid), { flag: 'wx' })

/** Claims the single run slot. A lock left by a crashed run is taken over once it goes stale. */
export async function acquireLock(): Promise<boolean> {
	try {
		await claim()
		return true
	} catch {
		const age = await stat(FILES.lock).then(
			(s) => Date.now() - s.mtimeMs,
			() => 0
		)
		if (age < LOCK_STALE_MS) return false

		await rm(FILES.lock, { force: true })
		return claim().then(
			() => true,
			() => false
		)
	}
}
